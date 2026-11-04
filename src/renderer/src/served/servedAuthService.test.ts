import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthService } from '../services/authService'
import { SERVED_NOT_FAKE_TOKEN, SERVED_ON_ELECTRON } from './servedConstants'

const FAKE = { baseUrl: 'http://127.0.0.1:41733', token: 'fake-1b2c' }

const load = async (): Promise<AuthService> => (await import('./servedAuthService')).authService

describe('the served build auth service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', FAKE.baseUrl)
    vi.stubEnv('VITE_BEARER_TOKEN', FAKE.token)
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { authService?: unknown }).authService
  })

  it('gives the renderer the fake backend the build was made for', async () => {
    const authService = await load()
    await expect(authService.get()).resolves.toEqual(FAKE)
  })

  it('keeps that session whatever a screen tries to save or clear', async () => {
    const authService = await load()
    await expect(authService.set({ baseUrl: 'http://x', token: 'real' })).resolves.toEqual(FAKE)
    await expect(authService.clear()).resolves.toEqual(FAKE)
    await expect(authService.get()).resolves.toEqual(FAKE)
  })

  it('stores nothing in the browser', async () => {
    const authService = await load()
    await authService.set({ baseUrl: 'http://x', token: 'real' })
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('will not load inside the Electron app', async () => {
    ;(window as { authService?: unknown }).authService = {}
    await expect(load()).rejects.toThrow(SERVED_ON_ELECTRON)
  })

  it('will not load on a build made without a fake token', async () => {
    vi.stubEnv('VITE_BEARER_TOKEN', 'dev-test-token')
    await expect(load()).rejects.toThrow(SERVED_NOT_FAKE_TOKEN)
  })
})
