import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import TelegramBot from 'node-telegram-bot-api'

// Mock dependencies before import
vi.mock('../../src/config/env', () => ({ config: { backendSharedSecret: 'test-secret' } }))
vi.mock('../../src/lib/sessionStore')
vi.mock('../../src/lib/backendClient')
vi.mock('../../src/generated/backend')

import * as auth from '../../src/lib/auth'
import { getSession, setSession, clearSession, isAuthenticated } from '../../src/lib/sessionStore'
import { setAccessToken } from '../../src/lib/backendClient'
import { AuthService } from '../../src/generated/backend'

describe('lib/auth', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockBot = {
    sendMessage: vi.fn(),
  } as unknown as TelegramBot

  const mockMsg = {
    chat: { id: 12345 },
    from: { id: 54321, is_bot: false, first_name: 'Test' },
    text: '',
  } as TelegramBot.Message

  const userId = '54321'

  describe('getTelegramUserId', () => {
    it('should return user ID as string', () => {
      expect(auth.getTelegramUserId(mockMsg)).toBe('54321')
    })
    it('should return undefined if from is missing', () => {
      expect(auth.getTelegramUserId({ ...mockMsg, from: undefined })).toBeUndefined()
    })
  })

  describe('ensureAccessTokenForUser', () => {
    it('should set access token if session exists', () => {
      vi.mocked(getSession).mockReturnValue({ userId, accessToken: 'user-token' })
      auth.ensureAccessTokenForUser(userId)
      expect(setAccessToken).toHaveBeenCalledWith('user-token')
    })
    it('should set access token to undefined if session has no token', () => {
      vi.mocked(getSession).mockReturnValue({ userId, accessToken: '' })
      auth.ensureAccessTokenForUser(userId)
      expect(setAccessToken).toHaveBeenCalledWith(undefined)
    })
    it('should set access token to undefined if no session exists', () => {
      vi.mocked(getSession).mockReturnValue(undefined)
      auth.ensureAccessTokenForUser(userId)
      expect(setAccessToken).toHaveBeenCalledWith(undefined)
    })
  })

  describe('logoutUser', () => {
    it('should clear session, token, and pending state', () => {
      auth.logoutUser(userId)
      expect(clearSession).toHaveBeenCalledWith(userId)
      expect(setAccessToken).toHaveBeenCalledWith(undefined)
    })
  })

  describe('handleAuthMessage', () => {
    it('should return false if user is already authenticated', async () => {
      vi.mocked(isAuthenticated).mockReturnValue(true)
      // ensure downstream effect of ensureAccessTokenForUser by providing a session
      vi.mocked(getSession).mockReturnValue({ userId, accessToken: 'existing-token' })

      const result = await auth.handleAuthMessage(mockBot, mockMsg)

      expect(result).toBe(false)
      expect(setAccessToken).toHaveBeenCalledWith('existing-token')
      expect(mockBot.sendMessage).not.toHaveBeenCalled()
    })

    it('should prompt for access code if user is not authenticated', async () => {
      vi.mocked(isAuthenticated).mockReturnValue(false)
      const result = await auth.handleAuthMessage(mockBot, mockMsg)
      expect(result).toBe(true)
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        mockMsg.chat.id,
        expect.stringContaining('please enter your access code'),
      )
    })

    it('should handle successful login with a valid access code', async () => {
      vi.mocked(isAuthenticated).mockReturnValue(false)
      // 1. First message to trigger the prompt and add user to pending
      await auth.handleAuthMessage(mockBot, mockMsg)

      // 2. Second message with the access code
      const loginMsg = { ...mockMsg, text: 'valid-code' }
      const backendResponse = { accessToken: 'new-token', expiresIn: 3600 }
      vi.mocked(AuthService.authControllerLoginTelegram).mockResolvedValue(backendResponse)

      const result = await auth.handleAuthMessage(mockBot, loginMsg)

      expect(result).toBe(true)
      expect(AuthService.authControllerLoginTelegram).toHaveBeenCalledWith({
        requestBody: { externalId: userId, accessCode: 'valid-code', secret: 'test-secret' },
      })
      expect(setSession).toHaveBeenCalledWith(
        expect.objectContaining({ userId, accessToken: 'new-token' }),
      )
      expect(setAccessToken).toHaveBeenCalledWith('new-token')
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        mockMsg.chat.id,
        'You are now authenticated. 🎉',
      )
    })

    it('should handle failed login with an invalid access code', async () => {
      vi.mocked(isAuthenticated).mockReturnValue(false)
      // 1. Trigger prompt
      await auth.handleAuthMessage(mockBot, mockMsg)

      // 2. Send invalid code
      const loginMsg = { ...mockMsg, text: 'invalid-code' }
      vi.mocked(AuthService.authControllerLoginTelegram).mockRejectedValue(
        new Error('Invalid code'),
      )

      const result = await auth.handleAuthMessage(mockBot, loginMsg)

      expect(result).toBe(true)
      expect(AuthService.authControllerLoginTelegram).toHaveBeenCalledWith({
        requestBody: { externalId: userId, accessCode: 'invalid-code', secret: 'test-secret' },
      })
      expect(setSession).not.toHaveBeenCalled()
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        mockMsg.chat.id,
        expect.stringContaining('did not work'),
      )
    })

    it('should handle /cancel when pending access code', async () => {
      vi.mocked(isAuthenticated).mockReturnValue(false)
      // 1. Trigger prompt
      await auth.handleAuthMessage(mockBot, mockMsg)

      // 2. Send /cancel
      const cancelMsg = { ...mockMsg, text: '/cancel' }
      const result = await auth.handleAuthMessage(mockBot, cancelMsg)

      expect(result).toBe(true)
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        mockMsg.chat.id,
        'Cancelled. You can restart with /start when ready.',
      )
    })

    it('should send an error if user ID cannot be determined', async () => {
      const noFromMsg = { ...mockMsg, from: undefined }
      const result = await auth.handleAuthMessage(mockBot, noFromMsg)
      expect(result).toBe(true)
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        mockMsg.chat.id,
        'Unable to determine your Telegram user id.',
      )
    })
  })
})
