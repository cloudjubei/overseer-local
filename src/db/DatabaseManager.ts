import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import type { BaseManager } from '../managers'
import { openDatabase, TheFactoryDb } from 'thefactory-db'
import { MatchParams } from 'thefactory-db/dist/types'

export default class DatabaseManager implements BaseManager {
  private projectRoot: string
  private window: BrowserWindow
  private _ipcBound: boolean
  private _dbClient: TheFactoryDb | undefined
  private _connectionString: string | undefined
  private _status: { connected: boolean; lastError?: string }

  constructor(projectRoot: string, window: BrowserWindow) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false

    this._dbClient = undefined
    this._connectionString = undefined
    this._status = {
      connected: false,
      lastError: undefined,
    }
  }

  async init(): Promise<void> {
    this._registerIpcHandlers()
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => Promise<any> | any> = {}
    handlers[IPC_HANDLER_KEYS.DB_CONNECT] = async ({ connectionString }) =>
      await this.connect(connectionString)
    handlers[IPC_HANDLER_KEYS.DB_GET_STATUS] = async () => await this.getStatus()
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_ADD] = async ({ input }) =>
      await this._dbClient?.addEntity(input)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_GET] = async ({ id }) =>
      await this._dbClient?.getEntityById(id)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_UPDATE] = async ({ id, patch }) =>
      await this._dbClient?.updateEntity(id, patch)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_DELETE] = async ({ id }) =>
      await this._dbClient?.deleteEntity(id)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_SEARCH] = async ({ params }) =>
      await this._dbClient?.searchEntities(params)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_MATCH] = async ({ criteria, options }) =>
      await this._dbClient?.matchEntities(criteria, options)
    handlers[IPC_HANDLER_KEYS.DB_ENTITIES_CLEAR] = async ({ projectIds }) =>
      await this._dbClient?.clearEntities(projectIds)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_ADD] = async ({ input }) => await this.addDocument(input)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_ID] = async ({ id }) =>
      await this.getDocumentById(id)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_SRC] = async ({ src }) =>
      await this.getDocumentBySrc(src)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_UPDATE] = async ({ id, patch }) =>
      await this.updateDocument(id, patch)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_DELETE] = async ({ id }) => await this.deleteDocument(id)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_SEARCH] = async ({ params }) =>
      await this.searchDocuments(params)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_MATCH] = async ({ options }) =>
      await this.matchDocuments(options)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_CLEAR] = async ({ projectIds }) =>
      await this.clearDocuments(projectIds)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (_event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e: any) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  async connect(connectionString: string): Promise<{ connected: boolean; lastError?: string }> {
    try {
      this._dbClient = await openDatabase({ connectionString })
      this._connectionString = connectionString
      this._setConnected(true)
      console.log('[db] thefactory-db client initialized')
    } catch (err: any) {
      this._status.lastError = err?.message || String(err)
      this._setConnected(false)
      console.error('[db] Failed to initialize thefactory-db:', err?.message || err)
    }
    return this.getStatus()
  }

  getConnectionString(): string | undefined {
    return this._connectionString
  }

  getStatus(): { connected: boolean; lastError?: string } {
    return { ...this._status }
  }

  async close(): Promise<void> {
    if (!this.isConnected()) {
      return
    }

    try {
      await this._dbClient?.close()
      console.log('[db] thefactory-db client closed')
    } catch (e: any) {
      console.warn('[db] Error closing thefactory-db client:', e?.message || e)
    } finally {
      this._dbClient = undefined
      this._setConnected(false)
    }
  }

  isConnected(): boolean {
    return this._status.connected
  }

  async stopWatching(): Promise<void> {
    await this.close()
  }

  async addDocument(input: any): Promise<any> {
    return await this._dbClient?.addDocument(input)
  }
  async getDocumentById(id: string): Promise<any> {
    return await this._dbClient?.getDocumentById(id)
  }
  async getDocumentBySrc(src: string): Promise<any> {
    return await this._dbClient?.getDocumentBySrc(src)
  }
  async updateDocument(id: string, patch: any): Promise<any> {
    return await this._dbClient?.updateDocument(id, patch)
  }
  async deleteDocument(id: string): Promise<any> {
    return await this._dbClient?.deleteDocument(id)
  }
  async searchDocuments(params: any): Promise<any> {
    return await this._dbClient?.searchDocuments(params)
  }
  async matchDocuments(options: MatchParams): Promise<any> {
    return await this._dbClient?.matchDocuments(options)
  }
  async clearDocuments(projectIds?: string[]): Promise<any> {
    return await this._dbClient?.clearDocuments(projectIds)
  }
  private _setConnected(connected: boolean): void {
    this._status.connected = !!connected
    this._emitStatus()
  }

  private _emitStatus(): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.DB_SUBSCRIBE, this.getStatus())
      }
    } catch (e) {
      // noop
    }
  }
}
