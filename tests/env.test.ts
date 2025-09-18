import { describe, it, expect, beforeEach } from 'vitest'

describe('config/env', () => {
  const ORIGINAL = { ...process.env }

  beforeEach(() => {
    // reset module cache so env.ts re-evaluates
    vi.resetModules()
    process.env = { ...ORIGINAL }
  })

  it('loads required and optional variables', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'X'
    process.env.BACKEND_SHARED_SECRET = 'Y'
    process.env.BACKEND_BASE_URL = 'http://example.com'
    process.env.TZ = 'Europe/London'
    const { config, getEnv } = await import('../src/config/env')
    expect(config.telegramBotToken).toBe('X')
    expect(config.backendSharedSecret).toBe('Y')
    expect(config.backendBaseUrl).toBe('http://example.com')
    expect(config.timezone).toBe('Europe/London')
    expect(getEnv('telegramBotToken')).toBe('X')
  })

  it('throws on missing required variables', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.BACKEND_SHARED_SECRET
    await expect(import('../src/config/env')).rejects.toThrow(/Missing required environment variable/)
  })
})
