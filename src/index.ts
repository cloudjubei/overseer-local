import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api'
import { config } from './config/env'
import { handleAuthMessage, ensureBackendConfigured, ensureAccessTokenForUser } from './lib/auth'
import { getSession, setSession } from './lib/sessionStore'
import { handleConversationMessage } from './conversations/conversationManager'
import { renderBackendPrompt } from './conversations/promptRenderer'
import { ConversationsService } from './generated/backend/services/ConversationsService'
import { ConversationResponseDto } from './generated/backend/models/ConversationResponseDto'
import { StartFlowDto } from './generated/backend/models/StartFlowDto'

// Initialize Telegram bot
const bot = new TelegramBot(config.telegramBotToken, { polling: true })

// Helper to start a backend conversation flow and process the initial response
async function startBackendFlow(params: {
  userId: string
  chatId: number
  flowId: string
  externalId?: string
}) {
  const { userId, chatId, flowId, externalId } = params

  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  const req: StartFlowDto = {
    flow: flowId,
    channel: StartFlowDto.channel.TELEGRAM,
    externalId,
  }

  try {
    const res = await ConversationsService.conversationsControllerStart({ requestBody: req })

    const flow = res.flow
    const sessionId = res.sessionId
    const now = Math.floor(Date.now() / 1000)

    switch (res.type) {
      case ConversationResponseDto.type.PROMPT: {
        // Persist conversation state
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: {
            flowId: flow,
            context: { sessionId },
            lastUpdatedAt: now,
          },
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        if (res.prompt) {
          await renderBackendPrompt(res.prompt, bot, chatId)
        }
        break
      }
      case ConversationResponseDto.type.SUCCESS: {
        // Clear conversation state and show success message if provided
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId, accessToken: prev?.accessToken || '' }),
          conversationState: null,
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        const text = (res.success as any)?.message || 'Done.'
        await bot.sendMessage(chatId, text)
        break
      }
      case ConversationResponseDto.type.ERROR: {
        // Decide whether to keep conversation based on retry flag
        const retry = !!(res.error as any)?.retry
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId, accessToken: prev?.accessToken || '' }),
          conversationState: retry
            ? {
                flowId: flow,
                context: { sessionId },
                lastUpdatedAt: now,
              }
            : null,
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        const msg = (res.error as any)?.message || 'Something went wrong.'
        await bot.sendMessage(chatId, msg)
        break
      }
      default: {
        await bot.sendMessage(chatId, 'Unexpected response while starting the flow.')
        break
      }
    }
  } catch (err: any) {
    // Minimal user-facing error message
    console.error('startBackendFlow error', err?.response?.data || err?.message || err)
    await bot.sendMessage(chatId, 'Sorry, failed to start the conversation. Please try again later.')
  }
}

// Message handler
bot.on('message', async (msg: Message) => {
  try {
    const { chat, from } = msg
    if (!from || !chat) return

    // Global auth flow: returns true if it handled the message (prompted or processed)
    const authHandled = await handleAuthMessage(bot, msg)
    if (authHandled) return

    const userId = String(from.id)
    const session = getSession(userId)

    // If an active backend-driven conversation exists, delegate to conversation manager
    if (session?.conversationState) {
      const convHandled = await handleConversationMessage(msg, session)
      if (convHandled) {
        switch (convHandled.type) {
          case 'prompt':
            if (convHandled.prompt) await renderBackendPrompt(convHandled.prompt, bot, chat.id)
            break
          case 'success': {
            const text = (convHandled.success as any)?.message || 'Done.'
            await bot.sendMessage(chat.id, text)
            break
          }
          case 'error': {
            const text = (convHandled.error as any)?.message || 'Something went wrong.'
            await bot.sendMessage(chat.id, text)
            break
          }
        }
        return // conversation consumed this message
      }
    }

    // Command handling
    const text = (msg.text || '').trim()

    // /profile -> start profile update flow via backend conversations
    if (/^\/(profile)(@\w+)?$/i.test(text)) {
      const PROFILE_UPDATE_FLOW_ID = 'profile.update' // Backend flow id for updating a profile
      await startBackendFlow({ userId, chatId: chat.id, flowId: PROFILE_UPDATE_FLOW_ID, externalId: userId })
      return
    }

    // /newgoal -> start new goal flow via backend conversations
    if (/^\/(newgoal)(@\w+)?$/i.test(text)) {
      const NEW_GOAL_FLOW_ID = 'goals.new' // Backend flow id for creating a new goal
      await startBackendFlow({ userId, chatId: chat.id, flowId: NEW_GOAL_FLOW_ID, externalId: userId })
      return
    }

    // Other commands/messages can be handled here as needed
  } catch (err) {
    if (msg.chat?.id) {
      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong handling your message.')
    }
  }
})

// Callback query handler (minimal; conversation selections may be handled in future updates)
bot.on('callback_query', async (cb: CallbackQuery) => {
  try {
    const message = cb.message
    if (!message?.chat?.id) return

    // For now, acknowledge callbacks to avoid client spinners
    try {
      await bot.answerCallbackQuery(cb.id)
    } catch {}

    // Optionally parse and handle selection callbacks here in the future
  } catch (err) {
    if (cb.id) {
      try {
        await bot.answerCallbackQuery(cb.id, { text: 'An error occurred.' })
      } catch {}
    }
    if (cb.message?.chat?.id) {
      await bot.sendMessage(cb.message.chat.id, 'Sorry, something went wrong handling your selection.')
    }
  }
})

// Export bot for potential external usage
export { bot }
