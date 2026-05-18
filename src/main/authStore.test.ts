import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthStore, type Cipher } from './authStore'

/**
 * Fake cipher that round-trips through base64. Stand-in for Electron's
 * `safeStorage` so the store can be exercised in a Node test environment.
 */
const fakeCipher: Cipher = {
  isEncryptionAvailable: () => true,
  encryptString: (s) => Buffer.from(s, 'utf8').toString('base64') as unknown as Buffer,
  decryptString: (b) => Buffer.from(String(b), 'base64').toString('utf8'),
}

/** Plaintext cipher: encryption returns the raw string, used to assert behaviour when unavailable. */
const plaintextCipher: Cipher = {
  isEncryptionAvailable: () => false,
  encryptString: (s) => s as unknown as Buffer,
  decryptString: (b) => String(b),
}

describe('authStore', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'overseer-auth-store-'))
    file = join(dir, 'auth.bin')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns empty state when no file exists', () => {
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    expect(store.read()).toEqual({ baseUrl: null, token: null })
  })

  it('persists and reads back baseUrl and token', () => {
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    store.write({ baseUrl: 'http://localhost:3000', token: 'secret-token' })
    expect(existsSync(file)).toBe(true)
    expect(store.read()).toEqual({ baseUrl: 'http://localhost:3000', token: 'secret-token' })
  })

  it('round-trips token through the cipher (encrypted at rest)', () => {
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    store.write({ baseUrl: null, token: 'sk-live-abc' })
    // Re-open and ensure the on-disk blob is not the plaintext token.
    const fs = require('node:fs') as typeof import('node:fs')
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'))
    expect(onDisk.token).not.toBe('sk-live-abc')
    expect(store.read().token).toBe('sk-live-abc')
  })

  it('clear() wipes the stored state', () => {
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    store.write({ baseUrl: 'http://x', token: 't' })
    store.clear()
    expect(store.read()).toEqual({ baseUrl: null, token: null })
  })

  it('allows writing baseUrl alone, leaving token null', () => {
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    store.write({ baseUrl: 'http://localhost:4000', token: null })
    expect(store.read()).toEqual({ baseUrl: 'http://localhost:4000', token: null })
  })

  it('falls back to plaintext token storage when encryption is unavailable', () => {
    const store = createAuthStore({ storeFile: file, cipher: plaintextCipher })
    store.write({ baseUrl: null, token: 'plain' })
    expect(store.read().token).toBe('plain')
  })

  it('ignores a corrupted store file and returns empty state', () => {
    const fs = require('node:fs') as typeof import('node:fs')
    fs.writeFileSync(file, '{not-json')
    const store = createAuthStore({ storeFile: file, cipher: fakeCipher })
    expect(store.read()).toEqual({ baseUrl: null, token: null })
  })
})
