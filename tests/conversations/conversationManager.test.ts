import { describe, it, expect, vi, beforeEach } from 'vitest';
import type TelegramBot from 'node-telegram-bot-api';

// Mock dependencies
vi.mock('../../src/lib/sessionStore');
vi.mock('../../src/lib/auth');
vi.mock('../../src/generated/backend');

import { handleConversationMessage } from '../../src/conversations/conversationManager';
import { setSession, SessionData } from '../../src/lib/sessionStore';
import { ConversationsService, ConversationResponseDto } from '../../src/generated/backend';

describe('conversations/conversationManager', () => {
  const mockBot = { sendMessage: vi.fn() } as unknown as TelegramBot;
  const mockMsg = {
    chat: { id: 123 },
    from: { id: 456 },
    text: 'user input',
  } as TelegramBot.Message;

  const initialSession: SessionData = {
    userId: '456',
    accessToken: 'token',
    conversationState: {
      flowId: 'profile.update',
      context: { sessionId: 'session-abc' },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return null if there is no active conversation', async () => {
    const session = { ...initialSession, conversationState: null };
    const result = await handleConversationMessage(mockBot, mockMsg, session);
    expect(result).toBeNull();
  });

  it('should return null and clear state if sessionId is missing', async () => {
    const corruptSession = { ...initialSession, conversationState: { flowId: 'test' } };
    const result = await handleConversationMessage(mockBot, mockMsg, corruptSession as any);
    expect(result).toBeNull();
    expect(setSession).toHaveBeenCalledWith({ ...corruptSession, conversationState: null });
  });

  it('should handle a PROMPT response from the backend', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.PROMPT,
      flow: 'profile.update',
      sessionId: 'session-def',
      prompt: { title: 'New Prompt' },
    };
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(backendResponse as any);

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession);

    expect(ConversationsService.conversationsControllerHandle).toHaveBeenCalledWith({
      requestBody: expect.objectContaining({ flow: 'profile.update', sessionId: 'session-abc', input: { text: 'user input' } }),
    });

    expect(setSession).toHaveBeenCalledWith({
      ...initialSession,
      conversationState: {
        flowId: 'profile.update',
        context: { sessionId: 'session-def' },
        lastUpdatedAt: expect.any(Number),
      },
    });

    expect(result).toEqual({ type: 'prompt', flow: 'profile.update', sessionId: 'session-def', prompt: { title: 'New Prompt' } });
    expect(mockBot.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle a SUCCESS response from the backend', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.SUCCESS,
      flow: 'profile.update',
      sessionId: 'session-def',
      success: { message: 'Profile updated!' },
    };
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(backendResponse as any);

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession);

    expect(setSession).toHaveBeenCalledWith({ ...initialSession, conversationState: null });
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Profile updated!');
    expect(result).toEqual({ type: 'success', flow: 'profile.update', sessionId: 'session-def', success: { message: 'Profile updated!' } });
  });

  it('should handle an ERROR response from the backend and clear state', async () => {
    const backendResponse = {
      type: ConversationResponseDto.type.ERROR,
      flow: 'profile.update',
      sessionId: 'session-def',
      error: { message: 'Invalid input.' },
    };
    vi.mocked(ConversationsService.conversationsControllerHandle).mockResolvedValue(backendResponse as any);

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession);

    expect(setSession).toHaveBeenCalledWith({ ...initialSession, conversationState: null });
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Invalid input.');
    expect(result).toEqual({ type: 'error', flow: 'profile.update', sessionId: 'session-def', error: { message: 'Invalid input.' } });
  });

  it('should handle a failed API call and preserve state', async () => {
    vi.mocked(ConversationsService.conversationsControllerHandle).mockRejectedValue(new Error('Network Error'));

    const result = await handleConversationMessage(mockBot, mockMsg, initialSession);

    // State should be preserved on failure to allow for retry
    expect(setSession).toHaveBeenCalledWith({
        ...initialSession,
        conversationState: {
            ...initialSession.conversationState,
            lastUpdatedAt: expect.any(Number),
        }
    });
    expect(mockBot.sendMessage).toHaveBeenCalledWith(123, 'Sorry, something went wrong. Please try again.');
    expect(result).toEqual({
      type: 'error',
      flow: 'profile.update',
      sessionId: 'session-abc',
      error: { message: 'Sorry, something went wrong. Please try again.', retry: true },
    });
  });
});
