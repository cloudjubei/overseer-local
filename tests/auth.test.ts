import { describe, it, expect, vi, beforeEach } from 'vitest'

const fakeBot = () => {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    sendChatAction: vi.fn().mockResolvedValue(undefined),
  } as any
}

describe('auth flow', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('prompts for access code when unauthenticated, handles cancel', async () => {
    const bot = fakeBot()
    const { handleAuthMessage } = await import('../src/lib/auth')

    const msg: any = { chat: { id: 1 }, text: 'hello', from: { id: 42 } }

    // First message should prompt
    const handled1 = await handleAuthMessage(bot, msg)
    expect(handled1).toBe(true)
    expect(bot.sendMessage).toHaveBeenCalled()

    // Send /cancel while pending
    const handled2 = await handleAuthMessage(bot, { ...msg, text: '/cancel' })
    expect(handled2).toBe(true)
  })

  it('logs in successfully with access code and stores session', async () => {
    const bot = fakeBot()
    const { handleAuthMessage } = await import('../src/lib/auth')
    const { AuthService } = await import('../src/generated/backend')
    ;(AuthService.authControllerLoginTelegram as any).mockResolvedValue({
      accessToken: 'AT',
      idToken: 'ID',
      refreshToken: 'RT',
      expiresIn: 3600,
    })

    const msg: any = { chat: { id: 1 }, text: 'hi', from: { id: 99 } }

    // Prompt
    await handleAuthMessage(bot, msg)

    // Provide access code
    const handled = await handleAuthMessage(bot, { ...msg, text: 'CODE123' })
    expect(handled).toBe(true)
    expect(AuthService.authControllerLoginTelegram).toHaveBeenCalled()
  })

  it('keeps pending on failed login', async () => {
    const bot = fakeBot()
    const { handleAuthMessage } = await import('../src/lib/auth')
    const { AuthService } = await import('../src/generated/backend')
    ;(AuthService.authControllerLoginTelegram as any).mockRejectedValue(new Error('bad code'))

    const msg: any = { chat: { id: 1 }, text: 'hi', from: { id: 77 } }

    // Prompt
    await handleAuthMessage(bot, msg)

    // Provide invalid code
    const handled = await handleAuthMessage(bot, { ...msg, text: 'WRONG' })
    expect(handled).toBe(true)
    expect(AuthService.authControllerLoginTelegram).toHaveBeenCalled()
  })
})
