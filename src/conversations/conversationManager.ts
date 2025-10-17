import type TelegramBot from 'node-telegram-bot-api'
import {
  ConversationResponseModel,
  ConversationsService,
  HandleInputModel,
} from '../generated/backend'
import { setSession, type SessionData } from '../lib/sessionStore'
import { ensureBackendConfigured, ensureAccessTokenForUser } from '../lib/auth'
import { logger } from '../lib/logger'

export type ConversationHandleResult =
  | { type: 'prompt'; flow: string; sessionId: string; prompt: ConversationResponseModel['prompt'] }
  | {
      type: 'success'
      flow: string
      sessionId: string
      success: ConversationResponseModel['success']
    }
  | { type: 'error'; flow: string; sessionId: string; error: ConversationResponseModel['error'] }

function extractExternalId(msg: TelegramBot.Message): string | undefined {
  const id = msg.from?.id
  return typeof id === 'number' ? String(id) : undefined
}

function extractChatId(msg: TelegramBot.Message): number | undefined {
  const id = msg.chat?.id
  return typeof id === 'number' ? id : undefined
}

function buildInputFromMessage(msg: TelegramBot.Message): Record<string, any> {
  // Generic adapter: pass plain text under "text". Backend-driven flows should interpret this.
  // If richer mappings are needed (e.g., selections), extend this function accordingly.
  if (typeof msg.text === 'string' && msg.text.length > 0) {
    return { text: msg.text }
  }
  // Fallback empty object if no usable content
  return {}
}

/**
 * Handle a Telegram message for an active backend-driven conversation.
 * - Reads active conversation from session.conversationState
 * - Packages message into HandleInputDto and calls ConversationsService.conversationsControllerHandle
 * - Persists/clears conversation state based on response type (prompt/success/error)
 * - For SUCCESS and ERROR responses, sends the backend-provided message to the user and clears state
 *
 * Returns null if there is no active conversation for the session.
 */
export async function handleConversationMessage(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  session: SessionData,
): Promise<ConversationHandleResult | null> {
  const convo = session.conversationState
  const externalId = extractExternalId(msg)
  const chatId = extractChatId(msg)

  if (!convo || !convo.flowId) return null

  // Session id must be tracked in conversation context as provided by backend
  const sessionId = String(convo.context?.sessionId || '')
  if (!sessionId) {
    // Corrupt/missing state; clear to avoid user getting stuck
    setSession({ ...session, conversationState: null })
    return null
  }

  // Ensure backend client is configured and token set for this user
  await ensureBackendConfigured()
  ensureAccessTokenForUser(session.userId)

  const input: HandleInputModel = {
    flow: convo.flowId,
    sessionId,
    input: buildInputFromMessage(msg),
    channel: HandleInputModel.channel.TELEGRAM,
    externalId,
  }

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - generated client naming
    const res = await ConversationsService.conversationsControllerHandle({ requestBody: input })

    const flow = typeof res?.flow === 'string' ? res.flow : convo.flowId
    const newSessionId = typeof res?.sessionId === 'string' ? res.sessionId : sessionId

    switch (res?.type) {
      case ConversationResponseModel.type.PROMPT: {
        // Persist conversation for next step, store sessionId in context
        setSession({
          ...session,
          conversationState: {
            lastAction: '',
            flowId: flow,
            context: { ...(convo.context || {}), sessionId: newSessionId },
            lastUpdatedAt: Math.floor(Date.now() / 1000),
          },
        })
        return { type: 'prompt', flow, sessionId: newSessionId, prompt: res.prompt }
      }
      case ConversationResponseModel.type.SUCCESS: {
        // Clear conversation on success and send success message if available
        setSession({ ...session, conversationState: null })
        if (chatId) {
          const text = res.success?.message || 'Done.'
          try {
            await bot.sendMessage(chatId, text)
          } catch {}
        }
        return { type: 'success', flow, sessionId: newSessionId, success: res.success }
      }
      case ConversationResponseModel.type.ERROR: {
        // Terminate the flow on error to avoid the user getting stuck in a broken state
        setSession({ ...session, conversationState: null })
        if (chatId) {
          const msgText = (res.error as any)?.message || 'Something went wrong.'
          try {
            await bot.sendMessage(chatId, msgText)
          } catch {}
        }
        return { type: 'error', flow, sessionId: newSessionId, error: res.error }
      }
      default: {
        // Unknown type: keep state as-is to avoid losing context
        return {
          type: 'error',
          flow,
          sessionId: newSessionId,
          error: { message: 'Unexpected conversation response.', retry: true },
        }
      }
    }
  } catch (err: any) {
    // Network or server error: keep conversation so user can retry
    logger.error('conversations: handle error', err?.response?.data || err?.message || err)
    setSession({
      ...session,
      conversationState: {
        lastAction: '',
        flowId: convo.flowId,
        context: { ...(convo.context || {}), sessionId },
        lastUpdatedAt: Math.floor(Date.now() / 1000),
      },
    })
    if (chatId) {
      try {
        await bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.')
      } catch {}
    }
    return {
      type: 'error',
      flow: convo.flowId,
      sessionId,
      error: { message: 'Sorry, something went wrong. Please try again.', retry: true },
    }
  }
}
