import { ipcMain } from 'electron'
import AppSettings from '../settings/AppSettings'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { openDatabase } from 'thefactory-db'

export class DatabaseManager {
  constructor(projectRoot, window, projectsManager) {
    this.projectRoot = projectRoot
    this.window = window

    this._dbClient = undefined
    this._connectionString = undefined
    this._status = {
      connected: false,
      lastError: undefined,
    }
  }

  async init() {
    this._registerIpcHandlers()
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}
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
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_MATCH] = async ({ criteria, options }) =>
      await this.matchDocuments(criteria, options)
    handlers[IPC_HANDLER_KEYS.DB_DOCUMENTS_CLEAR] = async ({ projectIds }) =>
      await this.clearDocuments(projectIds)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  async connect(connectionString) {
    try {
      this._dbClient = await openDatabase({ connectionString })
      this._connectionString = connectionString
      this._setConnected(true)
      console.log('[db] thefactory-db client initialized')
    } catch (err) {
      this._status.lastError = err?.message || String(err)
      this._setConnected(false)
      console.error('[db] Failed to initialize thefactory-db:', err?.message || err)
    }
    return this.getStatus()
  }

  getConnectionString() {
    return this._connectionString
  }

  getStatus() {
    return { ...this._status }
  }

  async close() {
    if (!this.isConnected()) {
      return
    }

    try {
      await this._dbClient.close()
      console.log('[db] thefactory-db client closed')
    } catch (e) {
      console.warn('[db] Error closing thefactory-db client:', e?.message || e)
    } finally {
      this._dbClient = null
      this._setConnected(false)
    }
  }

  isConnected() {
    return this._status.connected
  }

  async stopWatching() {
    await this.close()
  }

  async addDocument(input) {
    return await this._dbClient?.addDocument(input)
  }
  async getDocumentById(id) {
    return await this._dbClient?.getDocumentById(id)
  }
  async getDocumentBySrc(src) {
    return await this._dbClient?.getDocumentBySrc(src)
  }
  async updateDocument(id, patch) {
    return await this._dbClient?.updateDocument(id, patch)
  }
  async deleteDocument(id) {
    return await this._dbClient?.deleteDocument(src)
  }
  async searchDocuments(params) {
    return await this._dbClient?.searchDocuments(params)
  }
  async matchDocuments(criteria, options) {
    return await this._dbClient?.matchDocuments(criteria, options)
  }
  async clearDocuments(projectIds) {
    return await this._dbClient?.clearDocuments(projectIds)
  }

  _setConnected(connected) {
    this._status.connected = !!connected
    this._emitStatus()
  }

  _emitStatus() {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.DB_SUBSCRIBE, this.getStatus())
      }
    } catch (e) {
      // noop
    }
  }
}

export default DatabaseManager
