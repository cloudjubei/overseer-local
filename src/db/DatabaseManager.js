import AppSettings from '../settings/AppSettings'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'

// thefactory-db minimal client wrapper
// We expect the package to expose a createClient or Client constructor that accepts a connection string.
// To be resilient across versions, we try common exports.
function resolveDbFactory(mod) {
  if (!mod) return null
  if (typeof mod.createClient === 'function') return mod.createClient
  if (mod.Client && typeof mod.Client === 'function') return (opts) => new mod.Client(opts)
  if (typeof mod.default === 'function') return mod.default
  return null
}

export class DatabaseManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot
    this.window = window
    this._client = null
    this._started = false
    this._connectionString = ''

    this._status = {
      connected: false,
      connectionString: '',
      lastError: null,
      lastSyncAt: null,
      projects: {}, // { [projectId]: { lastSyncAt: string | null } }
    }
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

  _setConnected(connected) {
    this._status.connected = !!connected
    this._emitStatus()
  }

  markProjectSynced(projectId, when = new Date()) {
    const ts = when instanceof Date ? when.toISOString() : String(when)
    this._status.projects[projectId] = { lastSyncAt: ts }
    // overall last sync is the max timestamp
    const allTs = Object.values(this._status.projects)
      .map((p) => p?.lastSyncAt)
      .filter(Boolean)
      .sort()
    this._status.lastSyncAt = allTs.length ? allTs[allTs.length - 1] : ts
    this._emitStatus()
  }

  async init() {
    if (this._started) return
    this._started = true

    // Read user-provided connection string from persisted AppSettings (main process side)
    const appSettings = new AppSettings().get()
    const connectionString =
      (appSettings?.database && appSettings.database.connectionString) ||
      process.env.THEFACTORY_DB_URL ||
      ''

    this._connectionString = connectionString || ''
    this._status.connectionString = this._connectionString

    try {
      // lazy require to avoid renderer bundling warnings
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dbModule = require('thefactory-db')
      const create = resolveDbFactory(dbModule)
      if (!create) {
        throw new Error('Unsupported thefactory-db export shape: missing createClient/Client')
      }

      if (!connectionString) {
        console.warn('[db] No database connection string provided. thefactory-db will not be initialized.')
        this._setConnected(false)
        return
      }

      // Common option forms: create({ connectionString }) or create(connectionString)
      let client
      try {
        client = create({ connectionString })
      } catch (e) {
        client = create(connectionString)
      }

      // Some clients require explicit connect/init
      if (client && typeof client.connect === 'function') {
        await client.connect()
      } else if (client && typeof client.init === 'function') {
        await client.init()
      }

      this._client = client
      this._status.lastError = null
      this._setConnected(!!client)
      console.log('[db] thefactory-db client initialized')
    } catch (err) {
      this._status.lastError = err?.message || String(err)
      this._setConnected(false)
      console.error('[db] Failed to initialize thefactory-db:', err?.message || err)
    }
  }

  getClient() {
    return this._client
  }

  getConnectionString() {
    return this._connectionString
  }

  getStatus() {
    return { ...this._status }
  }

  async close() {
    if (!this._client) {
      this._setConnected(false)
      return
    }
    try {
      if (typeof this._client.close === 'function') {
        await this._client.close()
      } else if (typeof this._client.end === 'function') {
        await this._client.end()
      } else if (typeof this._client.disconnect === 'function') {
        await this._client.disconnect()
      }
      console.log('[db] thefactory-db client closed')
    } catch (e) {
      console.warn('[db] Error closing thefactory-db client:', e?.message || e)
    } finally {
      this._client = null
      this._started = false
      this._connectionString = ''
      this._status.connectionString = ''
      this._setConnected(false)
    }
  }

  // Keep consistency with other managers
  async stopWatching() {
    await this.close()
  }
}

export default DatabaseManager
