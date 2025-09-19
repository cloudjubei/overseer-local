import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../../src/config/env', () => ({
  config: {
    backendBaseUrl: 'http://mock-api.com',
  },
}))

vi.mock('../../src/generated/backend/core/OpenAPI', () => ({
  OpenAPI: {
    BASE: '',
    TOKEN: undefined,
    WITH_CREDENTIALS: true, // Default to a value that we expect to be changed
  },
}))

// Import the module AFTER mocks are set up
import { configureBackendClient, setAccessToken } from '../../src/lib/backendClient'
import { OpenAPI } from '../../src/generated/backend/core/OpenAPI'
import { config } from '../../src/config/env'

describe('lib/backendClient', () => {
  beforeEach(() => {
    // Reset OpenAPI object state before each test
    OpenAPI.BASE = ''
    OpenAPI.TOKEN = undefined
    OpenAPI.WITH_CREDENTIALS = true
  })

  describe('configureBackendClient', () => {
    it('should set the base URL from config and configure credentials', () => {
      configureBackendClient()

      expect(OpenAPI.BASE).toBe(config.backendBaseUrl)
      expect(OpenAPI.WITH_CREDENTIALS).toBe(false)
    })

    it('should set the access token when provided', () => {
      const tokens = { accessToken: 'test-token-123' }
      configureBackendClient(tokens)

      expect(OpenAPI.TOKEN).toBe('test-token-123')
    })

    it('should set the access token to undefined if not provided', () => {
      // Set a pre-existing token to ensure it gets cleared
      OpenAPI.TOKEN = 'stale-token'

      configureBackendClient() // No tokens object
      expect(OpenAPI.TOKEN).toBeUndefined()

      configureBackendClient({}) // Empty tokens object
      expect(OpenAPI.TOKEN).toBeUndefined()
    })
  })

  describe('setAccessToken', () => {
    it('should set OpenAPI.TOKEN to the provided value', () => {
      setAccessToken('my-new-token')
      expect(OpenAPI.TOKEN).toBe('my-new-token')
    })

    it('should clear OpenAPI.TOKEN when called with undefined', () => {
      OpenAPI.TOKEN = 'a-token-that-will-be-cleared'
      setAccessToken(undefined)
      expect(OpenAPI.TOKEN).toBeUndefined()
    })

    it('should clear OpenAPI.TOKEN when called with no arguments', () => {
      OpenAPI.TOKEN = 'another-token-to-clear'
      setAccessToken()
      expect(OpenAPI.TOKEN).toBeUndefined()
    })
  })
})
