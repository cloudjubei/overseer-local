import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import { openDatabase, createReusableDatabase, TheFactoryDb } from 'thefactory-db'
import type {
  DocumentInput,
  MatchParams,
  Document,
  DocumentWithScore,
  DocumentUpsertInput,
} from 'thefactory-db'
import BaseManager from '../BaseManager'

export default class DatabaseManager extends BaseManager {
  private _dbClient: TheFactoryDb | undefined = undefined
  private _connectionString: string | undefined = undefined
  private _status: { connected: boolean; lastError?: string } = {
    connected: false,
    lastError: undefined,
  }

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
  }
  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

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
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_GET_BY_SRC] = async ({ projectId, src }) =>
      await this.getDocumentBySrc(projectId, src)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_UPDATE] = async ({ id, patch }) =>
      await this.updateDocument(id, patch)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_DELETE] = async ({ id }) => await this.deleteDocument(id)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_SEARCH] = async ({ params }) =>
      await this.searchDocuments(params)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_MATCH] = async ({ options }) =>
      await this.matchDocuments(options)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_CLEAR] = async ({ projectIds }) =>
      await this.clearDocuments(projectIds)

    return handlers
  }

  //TODO: think about what to do here with a custom db and using connectionString
  async connect(connectionString: string): Promise<{ connected: boolean; lastError?: string }> {
    try {
      const { connectionString } = await createReusableDatabase()

      this._dbClient = await openDatabase({ connectionString })
      this._connectionString = connectionString
      this._setConnected(true)
      console.log('[db] thefactory-db client initialized at ', connectionString)
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

  async cleanup(): Promise<void> {
    await this.close()
  }

  async addDocument(input: DocumentInput): Promise<Document | undefined> {
    return await this._dbClient?.addDocument(input)
  }
  async getDocumentById(id: string): Promise<Document | undefined> {
    return await this._dbClient?.getDocumentById(id)
  }
  async getDocumentBySrc(projectId: string, src: string): Promise<Document | undefined> {
    return await this._dbClient?.getDocumentBySrc(projectId, src)
  }
  async upsertDocuments(inputs: DocumentUpsertInput[]): Promise<Document[]> {
    return (await this._dbClient?.upsertDocuments(inputs)) ?? []
  }
  async upsertDocument(input: DocumentUpsertInput): Promise<Document | undefined> {
    return await this._dbClient?.upsertDocument(input)
  }
  async updateDocument(id: string, patch: Partial<DocumentInput>): Promise<Document | undefined> {
    return await this._dbClient?.updateDocument(id, patch)
  }
  async deleteDocument(id: string): Promise<boolean | undefined> {
    return await this._dbClient?.deleteDocument(id)
  }
  async searchDocuments(params: any): Promise<DocumentWithScore[]> {
    return (await this._dbClient?.searchDocuments(params)) ?? []
  }
  async matchDocuments(options: MatchParams): Promise<Document[]> {
    return (await this._dbClient?.matchDocuments(options)) ?? []
  }
  async clearDocuments(projectIds?: string[]): Promise<void> {
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
