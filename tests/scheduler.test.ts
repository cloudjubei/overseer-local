import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fakeBot = () => ({ sendMessage: vi.fn().mockResolvedValue(undefined) } as any)

describe('scheduler utilities and tick', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    const { shutdownScheduler } = await import('../src/lib/scheduler')
    shutdownScheduler()
  })

  it('extracts message from metadata', async () => {
    const { getMessageFromMetadata } = await import('../src/lib/scheduler')
    expect(getMessageFromMetadata(undefined)).toBeUndefined()
    expect(getMessageFromMetadata({})).toBeUndefined()
    expect(getMessageFromMetadata({ text: ' hi ' })).toBe('hi')
    expect(getMessageFromMetadata({ message: 'yo' })).toBe('yo')
  })

  it('ticks and sends messages for current hour', async () => {
    const bot = fakeBot()
    const { tickSchedulerOnce, initScheduler } = await import('../src/lib/scheduler')
    const { setSession } = await import('../src/lib/sessionStore')
    const { CheckInsService } = await import('../src/generated/backend/services/CheckInsService')

    const userId = '100'
    setSession({ userId, accessToken: 'AT' })

    const now = new Date('2024-01-01T10:15:00Z')
    ;(CheckInsService.checkInsControllerGetCheckIns as any).mockResolvedValue({
      items: [
        { id: 'a', start: '2024-01-01T10:00:00Z', metadata: { message: 'hello' } },
        { id: 'b', start: '2024-01-01T11:00:00Z', metadata: { message: 'later' } },
      ],
      cursor: undefined,
    })

    initScheduler(bot)

    await tickSchedulerOnce(now)

    expect(bot.sendMessage).toHaveBeenCalledTimes(1)
    expect(bot.sendMessage).toHaveBeenCalledWith(Number(userId), 'hello')
  })
})
