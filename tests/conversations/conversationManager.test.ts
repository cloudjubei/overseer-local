import { describe, it, expect, vi, beforeEach } from 'vitest'
import type TelegramBot from 'node-telegram-bot-api'

// Mock dependencies
vi.mock('../../src/lib/sessionStore')
vi.mock('../../src/lib/auth')
vi.mock('../../src/generated/backend')

import { handleConversationMessage } from '../../src/conversations/conversationManager'
import { setSession, SessionData } from '../../src/lib/sessionStore'
import { ConversationsService, ConversationResponseDto } from '../../src/generated/backend'
import { ensureBackendConfigured, ensureAccessTokenForUser } from '../../src/lib/auth'

describe('conversations/conversationManager', () => {
  const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot
  const mockMsg = {
    chat: { id: 123 },
    from: { id: 456, is_bot: false, first_name: 'Test' },
    text: 'user input',
  } as TelegramBot.Message

  const initialSession: SessionData = {
    userId: '456',
    accessToken: 'token',
    conversationState: {
      flowId: 'profile.update',
      context: { sessionId: 'session-abc' },
      lastUpdatedAt: 0,
    },
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return null if there is no active conversation', async () => {
    const session = { ...initialSession, conversationState: null }
    const result = await handleConversationMessage(mockBot, mockMsg, session)
    expect(result).toBeNull()
  })

  it('should return null and clear state if sessionId is missing', async () => {
    const corruptSession = { ...initialSession, conversationState: { flowId: 'test', context: {} } }
    const result = await handleConversationMessage(mockBot, mockMsg, corruptSession as any)
    expect(result).toBeNull()
    expect(setSession).toHaveBeenCalledWith({ ...corruptSession, conversationState: null })
  })

  it('should call auth helpers to configure the backend client', async () => {
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue({
      type: 'UNKNOWN',
    } as any)
    await handleConversationMessage(mockBot, mockMsg, initialSession)
    expect(ensureBackendConfigured).toHaveBeenCalled()
    expect(ensureAccessTokenForUser).toHaveBeenCalledWith(initialSession.userId)
  })

  it('should handle a PROMPT response', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.PROMPT,
      flow: 'profile.update',
      sessionId: 'session-def',
      prompt: { title: 'New Prompt' },
    }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession)

    expect(ConversationsService.conversationsControllerHandle).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({
        flow: 'profile.update',
        sessionId: 'session-abc',
        input: { text: 'user input' },
      }),
    })
    expect(setSession).toHaveBeenCalledWith({
      ...initialSession,
      conversationState: {
        flowId: 'profile.update',
        context: { sessionId: 'session-def' },
        lastUpdatedAt: expect.any(Number),
      },
    })
    expect(result).toEqual({
      type: 'prompt',
      flow: 'profile.update',
      sessionId: 'session-def',
      prompt: { title: 'New Prompt' },
    })
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
  })

  it('should handle a SUCCESS response and clear state', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.SUCCESS,
      flow: 'profile.update',
      sessionId: 'session-def',
      success: { message: 'Profile updated!' },
    }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession)

    expect(setSession).toHaveBeenCalledWith({ ...initialSession, conversationState: null })
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Profile updated!')
    expect(result).toEqual({ type: 'success', ...backendResponse })
  })

  it('should use fallback message for SUCCESS if none provided', async () => {
    const backendResponse = { type: ConversationResponseDto.type.SUCCESS, success: {} }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )
    await handleConversationMessage(mockBot, mockMsg, initialSession)
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Done.')
  })

  it('should handle an ERROR response and clear state', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.ERROR,
      error: { message: 'Invalid input.' },
    }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession)

    expect(setSession).toHaveBeenCalledWith({ ...initialSession, conversationState: null })
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Invalid input.')
    expect(result).toEqual(expect.objectContaining({ type: 'error', error: backendResponse.error }))
  })

  it('should use fallback message for ERROR if none provided', async () => {
    const backendResponse = { type: ConversationResponseDto.type.ERROR, error: {} }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )
    await handleConversationMessage(mockBot, mockMsg, initialSession)
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Something went wrong.')
  })

  it('should handle an unknown response type and NOT clear state', async () => {
    const backendResponse = { type: 'UNKNOWN_TYPE' }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession)

    expect(setSession).not.toHaveBeenCalled()
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
    expect(result).toEqual(
      expect.objectContaining({
        type: 'error',
        error: { message: 'Unexpected conversation response.', retry: true },
      }),
    )
  })

  it('should handle a failed API call and preserve state for retry', async () => {
    vi.mocked(ConversationsService.conversationsControllerHandle).mockRejectedValue(
      new Error('Network Error'),
    )
    const result = await handleConversationMessage(mockBot, mockMsg, initialSession)
    expect(setSession).toHaveBeenCalledWith({
      ...initialSession,
      conversationState: { ...initialSession.conversationState, lastUpdatedAt: expect.any(Number) },
    })
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      123,
      'Sorry, something went wrong. Please try again.',
    )
    expect(result).toEqual({
      type: 'error',
      flow: 'profile.update',
      sessionId: 'session-abc',
      error: { message: 'Sorry, something went wrong. Please try again.', retry: true },
    })
  })

  it('should build an empty input if message text is missing', async () => {
    const msgWithoutText = { ...mockMsg, text: undefined }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue({} as any)
    await handleConversationMessage(mockBot, msgWithoutText, initialSession)
    expect(ConversationsService.conversationsControllerHandle).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({ input: {} }),
      }),
    )
  })

  it('should not send messages if chatId is missing', async () => {
    const msgWithoutChatId = { ...mockMsg, chat: {} }
    const backendResponse = {
      type: ConversationResponseDto.type.SUCCESS,
      success: { message: 'test' },
    }
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(
      backendResponse as any,
    )
    await handleConversationMessage(mockBot, msgWithoutChatId as any, initialSession)
    expect(mockBot.sendMessage).not.toHaveBeenCalled()
  })
})
