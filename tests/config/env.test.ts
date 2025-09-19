import { describe, it, expect, beforeEach } from 'vitest'

// We'll dynamically import the module after tweaking env to assert behaviors

describe('config/env', () => {
  const origEnv = { ...process.env }

  beforeEach(() => {
    // Reset modules between tests so env.ts runs fresh
    Object.assign(process.env, origEnv)
  })

  it('should load config with defaults when optional BACKEND_BASE_URL missing', async () => {
    process.env.NODE_ENV = 'test'
    process.env.TELEGRAM_BOT_TOKEN = 'tok'
    process.env.BACKEND_SHARED_SECRET = 'secret'
    delete process.env.BACKEND_BASE_URL

    const mod = await import('../../src/config/env')
    expect(mod.config.nodeEnv).toBe('test')
    expect(mod.config.telegramBotToken).toBe('tok')
    expect(mod.config.backendSharedSecret).toBe('secret')
    expect(mod.config.backendBaseUrl).toBe('http://localhost:3000')
    expect(mod.getEnv('backendBaseUrl')).toBe('http://localhost:3000')
  })

  it('should throw if required TELEGRAM_BOT_TOKEN is missing', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.TELEGRAM_BOT_TOKEN
    process.env.BACKEND_SHARED_SECRET = 'secret'
    await expect(import('../../src/config/env')).rejects.toThrow(/Missing required environment variable: TELEGRAM_BOT_TOKEN/)
  })

  it('should throw if required BACKEND_SHARED_SECRET is missing', async () => {
    process.env.NODE_ENV = 'test'
    process.env.TELEGRAM_BOT_TOKEN = 'tok'
    delete process.env.BACKEND_SHARED_SECRET
    await expect(import('../../src/config/env')).rejects.toThrow(/Missing required environment variable: BACKEND_SHARED_SECRET/)
  })
})
