import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthService } from './authService'

const load = async (): Promise<AuthService> => (await import('./authService')).authService

describe('the desktop auth service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:41733')
    vi.stubEnv('VITE_BEARER_TOKEN', 'fake-1b2c')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    delete (window as { authService?: unknown }).authService
  })

  it('is the Electron bridge, whatever the env holds', async () => {
    const bridge = { get: vi.fn(), set: vi.fn(), clear: vi.fn() }
    ;(window as { authService?: unknown }).authService = bridge
    const authService = await load()
    expect(authService.get).toBe(bridge.get)
    expect(authService.set).toBe(bridge.set)
    expect(authService.clear).toBe(bridge.clear)
  })

  it('finds no state in the env when the bridge is missing', async () => {
    const authService = await load()
    expect(authService).toEqual({})
  })
})
