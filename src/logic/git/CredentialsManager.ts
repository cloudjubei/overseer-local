import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import BaseManager from '../BaseManager'
import AppStorage from '../settings/AppStorage'
import { v4 as uuidv4 } from 'uuid'

export type GitHubCredentials = {
  id: string
  name: string
  username: string
  email: string
  token: string
}

/**
 * CredentialsManager
 * - Stores GitHub credentials in main process using AppStorage under 'credentials'.
 * - Exposes CRUD over IPC and a subscription channel for changes.
 * - IMPORTANT: Tokens remain in main process storage; renderer only receives values via explicit calls.
 */
export default class CredentialsManager extends BaseManager {
  private storage: AppStorage
  private cache: GitHubCredentials[]

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
    this.storage = new AppStorage('credentials')
    this.cache = this.__load()
  }

  async init(): Promise<void> {
    // preload any defaults or migrations if needed
    await super.init()
  }

  private __storageKey() {
    return 'github_credentials'
  }

  private __load(): GitHubCredentials[] {
    try {
      const raw = this.storage.getItem(this.__storageKey())
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  private __persist(next: GitHubCredentials[]): void {
    try {
      this.storage.setItem(this.__storageKey(), JSON.stringify(next))
      this.cache = next
      this._broadcast()
    } catch (e) {
      console.error('Failed to persist credentials:', e)
    }
  }

  private _broadcast(): void {
    try {
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send(IPC_HANDLER_KEYS.CREDENTIALS_SUBSCRIBE, {})
      }
    } catch (_) {
      // ignore
    }
  }

  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.CREDENTIALS_LIST] = () => this.list()
    handlers[IPC_HANDLER_KEYS.CREDENTIALS_ADD] = ({ input }) => this.add(input)
    handlers[IPC_HANDLER_KEYS.CREDENTIALS_UPDATE] = ({ id, patch }) => this.update(id, patch)
    handlers[IPC_HANDLER_KEYS.CREDENTIALS_REMOVE] = ({ id }) => this.remove(id)

    return handlers
  }

  list(): GitHubCredentials[] {
    return this.cache
  }

  add(input: Omit<GitHubCredentials, 'id'>): GitHubCredentials {
    const next: GitHubCredentials = { ...input, id: uuidv4() }
    const all = [...this.cache, next]
    this.__persist(all)
    return next
  }

  update(id: string, patch: Partial<GitHubCredentials>): GitHubCredentials | undefined {
    const idx = this.cache.findIndex((c) => c.id === id)
    if (idx === -1) return undefined
    const updated = { ...this.cache[idx], ...patch, id }
    const all = [...this.cache]
    all[idx] = updated
    this.__persist(all)
    return updated
  }

  remove(id: string): void {
    const all = this.cache.filter((c) => c.id !== id)
    this.__persist(all)
  }

  /** Convenience: return the first credential, used as default when no mapping is configured */
  getDefault(): GitHubCredentials | undefined {
    return this.cache[0]
  }
}
