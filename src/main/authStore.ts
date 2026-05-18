import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Minimal cipher surface that matches the slice of Electron's `safeStorage`
 * the store uses. Defined separately so the store can be unit-tested with a
 * fake cipher in environments without Electron available.
 */
export type Cipher = {
  isEncryptionAvailable: () => boolean
  encryptString: (plaintext: string) => Buffer
  decryptString: (encrypted: Buffer) => string
}

export type AuthState = {
  baseUrl: string | null
  token: string | null
}

export type AuthStore = {
  read: () => AuthState
  write: (next: AuthState) => void
  clear: () => void
}

type StoredState = {
  baseUrl: string | null
  /**
   * Encrypted token blob, base64-encoded for JSON portability. `encrypted: true`
   * marks blobs that went through `safeStorage`; `encrypted: false` marks
   * the plaintext fallback when encryption is unavailable on the platform.
   */
  token: { value: string; encrypted: boolean } | null
}

export function createAuthStore(opts: { storeFile: string; cipher: Cipher }): AuthStore {
  const { storeFile, cipher } = opts

  function loadRaw(): StoredState {
    if (!existsSync(storeFile)) return { baseUrl: null, token: null }
    try {
      const parsed = JSON.parse(readFileSync(storeFile, 'utf8')) as unknown
      if (!parsed || typeof parsed !== 'object') return { baseUrl: null, token: null }
      const p = parsed as Partial<StoredState>
      return {
        baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : null,
        token:
          p.token && typeof p.token === 'object' && typeof p.token.value === 'string'
            ? { value: p.token.value, encrypted: Boolean(p.token.encrypted) }
            : null,
      }
    } catch {
      return { baseUrl: null, token: null }
    }
  }

  function decode(token: StoredState['token']): string | null {
    if (!token) return null
    if (!token.encrypted) return token.value
    try {
      return cipher.decryptString(Buffer.from(token.value, 'base64'))
    } catch {
      return null
    }
  }

  function encode(token: string | null): StoredState['token'] {
    if (token === null) return null
    if (!cipher.isEncryptionAvailable()) return { value: token, encrypted: false }
    const encrypted = cipher.encryptString(token)
    return { value: Buffer.from(encrypted as unknown as ArrayBuffer).toString('base64'), encrypted: true }
  }

  return {
    read(): AuthState {
      const raw = loadRaw()
      return { baseUrl: raw.baseUrl, token: decode(raw.token) }
    },
    write(next: AuthState): void {
      const payload: StoredState = { baseUrl: next.baseUrl, token: encode(next.token) }
      mkdirSync(dirname(storeFile), { recursive: true })
      writeFileSync(storeFile, JSON.stringify(payload), 'utf8')
    },
    clear(): void {
      if (existsSync(storeFile)) rmSync(storeFile, { force: true })
    },
  }
}
