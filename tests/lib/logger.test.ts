import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We'll dynamically import the logger after setting env, so it picks up LOG_LEVEL / NODE_ENV

describe('lib/logger', () => {
  const origEnv = { ...process.env }
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})

  beforeEach(() => {
    vi.resetModules()
    errorSpy.mockClear()
    warnSpy.mockClear()
    logSpy.mockClear()
    debugSpy.mockClear()
  })

  afterEach(() => {
    process.env = { ...origEnv }
  })

  it('suppresses warn and error by default in test env', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.LOG_LEVEL
    const { logger } = await import('../../src/lib/logger')

    logger.error('e1')
    logger.warn('w1')
    logger.info('i1')
    logger.debug('d1')

    expect(errorSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('i1')
    // debug should not print at default level
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('respects LOG_LEVEL when set', async () => {
    process.env.NODE_ENV = 'test'
    process.env.LOG_LEVEL = 'error'
    const { logger } = await import('../../src/lib/logger')

    logger.error('e2')
    logger.warn('w2')
    logger.info('i2')

    expect(errorSpy).toHaveBeenCalledWith('e2')
    expect(warnSpy).not.toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('logs normally outside test env', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.LOG_LEVEL
    const { logger } = await import('../../src/lib/logger')

    logger.warn('w3')
    logger.error('e3')
    logger.info('i3')

    expect(warnSpy).toHaveBeenCalledWith('w3')
    expect(errorSpy).toHaveBeenCalledWith('e3')
    expect(logSpy).toHaveBeenCalledWith('i3')
  })
})
