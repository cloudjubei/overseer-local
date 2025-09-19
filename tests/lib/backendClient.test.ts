import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/config/env', () => ({ config: { backendBaseUrl: 'http://api.local' } }))

import { configureBackendClient, setAccessToken } from '../../src/lib/backendClient'
import { OpenAPI } from '../../src/generated/backend/core/OpenAPI'

describe('lib/backendClient', () => {
  beforeEach(() => {
    // reset OpenAPI object state
    OpenAPI.BASE = '' as any
    OpenAPI.TOKEN = undefined
    OpenAPI.WITH_CREDENTIALS = true
  })

  it('configureBackendClient should set base URL and clear token when not provided', () => {
    configureBackendClient()
    expect(OpenAPI.BASE).toBe('http://api.local')
    expect(OpenAPI.WITH_CREDENTIALS).toBe(false)
    expect(OpenAPI.TOKEN).toBeUndefined()
  })

  it('configureBackendClient should set provided token', () => {
    configureBackendClient({ accessToken: 'abc' })
    expect(OpenAPI.BASE).toBe('http://api.local')
    expect(OpenAPI.TOKEN).toBe('abc')
  })

  it('setAccessToken should update OpenAPI.TOKEN', () => {
    setAccessToken('xyz')
    expect(OpenAPI.TOKEN).toBe('xyz')
    setAccessToken(undefined)
    expect(OpenAPI.TOKEN).toBeUndefined()
  })
})
