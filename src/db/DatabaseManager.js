import AppSettings from '../settings/AppSettings'

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
  }

  async init() {
    if (this._started) return
    this._started = true

    // Read user-provided connection string from persisted AppSettings (main process side)
    const appSettings = new AppSettings().get()
    const connectionString =
      appSettings?.database?.connectionString || process.env.THEFACTORY_DB_URL || ''

    this._connectionString = connectionString || ''

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
      console.log('[db] thefactory-db client initialized')
    } catch (err) {
      console.error('[db] Failed to initialize thefactory-db:', err?.message || err)
    }
  }

  getClient() {
    return this._client
  }

  getConnectionString() {
    return this._connectionString
  }

  async close() {
    if (!this._client) return
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
    }
  }

  // Keep consistency with other managers
  async stopWatching() {
    await this.close()
  }
}

export default DatabaseManager
