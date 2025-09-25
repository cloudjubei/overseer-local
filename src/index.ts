import TelegramBot, { CallbackQuery, Message } from 'node-telegram-bot-api'
import { config } from './config/env'
import { handleAuthMessage, ensureBackendConfigured, ensureAccessTokenForUser } from './lib/auth'
import { getSession, setSession } from './lib/sessionStore'
import { handleConversationMessage } from './conversations/conversationManager'
import { renderBackendPrompt } from './conversations/promptRenderer'
import { ConversationsService } from './generated/backend/services/ConversationsService'
import { ConversationResponseDto } from './generated/backend/models/ConversationResponseDto'
import { StartFlowDto } from './generated/backend/models/StartFlowDto'
import testAction from './actions/test'
import testLLMAction from './actions/testLLM'
import quickSuggestionAction from './actions/quickSuggestion'
import audioSuggestionAction from './actions/audioSuggestion'
import { GoalsService } from './generated/backend/services/GoalsService'
import { CreateGoalDto } from './generated/backend/models/CreateGoalDto'
import {
  clearSuggestionsForMessage,
  getSuggestionsForMessage,
  getSuggestionBundleForMessage,
} from './actions/suggestionState'
import { renderParamSuggestions } from './actions/suggestionRenderer'
import textSuggestionAction from './actions/textSuggestion'

// Initialize Telegram bot
const bot = new TelegramBot(config.telegramBotToken, { polling: true })

bot.setMyCommands(
  [
    // { command: 'start', description: 'Start the bot' },
    // { command: 'help', description: 'Show the help message' },
    { command: 'q', description: 'Pick a suggestion from a list' },
    { command: 't', description: 'Create a Macro Goal suggestion via AI (text)' },
    // { command: 'macro', description: 'Create a Macro Goal suggestion via AI (text)' },
    { command: 's', description: 'Create a Macro Goal suggestion via AI (sound)' },
    // { command: 'micro', description: 'Create a Micro Goal suggestion via AI (text)' },
  ],
  { scope: { type: 'all_private_chats' } },
)

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
            lastAction: '',
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
                lastAction: '',
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
    await bot.sendMessage(
      chatId,
      'Sorry, failed to start the conversation. Please try again later.',
    )
  }
}

// Message handler
bot.on('message', async (msg: Message) => {
  try {
    const { chat, from } = msg
    if (!from || !chat) return

    const rawText = (msg.text || '').trim()

    if (await testAction(bot, chat, rawText)) {
      return
    }
    if (await testLLMAction(bot, chat, from, rawText, msg)) {
      return
    }
    if (await handleAuthMessage(bot, msg)) return

    if (await quickSuggestionAction(bot, chat, from, rawText, msg)) {
      return
    }
    if (await textSuggestionAction(bot, chat, from, rawText)) {
      return
    }
    if (await audioSuggestionAction(bot, chat, from, rawText, msg)) {
      return
    }

    const userId = String(from.id)
    const session = getSession(userId)

    // If an active backend-driven conversation exists, delegate to conversation manager
    if (session?.conversationState) {
      const convHandled = await handleConversationMessage(bot, msg, session)
      if (convHandled) {
        switch (convHandled.type) {
          case 'prompt':
            if (convHandled.prompt) await renderBackendPrompt(convHandled.prompt, bot, chat.id)
            break
          case 'success':
          case 'error':
            // Message already sent and state cleared by conversationManager
            break
        }
        return // conversation consumed this message
      }
    }

    // /profile -> start profile update flow via backend conversations
    if (/^\/(profile)(@\w+)?$/i.test(rawText)) {
      const PROFILE_UPDATE_FLOW_ID = 'setup_profile' // Backend flow id for updating a profile
      await startBackendFlow({
        userId,
        chatId: chat.id,
        flowId: PROFILE_UPDATE_FLOW_ID,
        externalId: userId,
      })
      return
    }

    // /newgoal -> start new goal flow via backend conversations
    if (/^\/(newgoal)(@\w+)?$/i.test(rawText)) {
      const NEW_GOAL_FLOW_ID = 'goals.new' // Backend flow id for creating a new goal
      await startBackendFlow({
        userId,
        chatId: chat.id,
        flowId: NEW_GOAL_FLOW_ID,
        externalId: userId,
      })
      return
    }

    // Other commands/messages can be handled here as needed
  } catch (err) {
    if (msg.chat?.id) {
      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong handling your message.')
    }
  }
})

function buildDifficultyKeyboard(category: string): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  const diffs: { key: string; label: string; emoji: string }[] = [
    { key: 'EASY', label: 'Easy', emoji: '⭐' },
    { key: 'MEDIUM', label: 'Medium', emoji: '⭐⭐' },
    { key: 'HARD', label: 'Ambitious', emoji: '⭐⭐⭐' },
  ]
  diffs.forEach((d) => {
    rows.push([
      {
        text: `${d.emoji} ${d.label}`,
        callback_data: `q:diff:${category}:${d.key}`,
      },
    ])
  })
  return { inline_keyboard: rows }
}

// Callback query handler: process suggestion selections and create goals
bot.on('callback_query', async (cb: CallbackQuery) => {
  try {
    console.log('callback cb: ', cb)

    const message = cb.message
    const data = cb.data || ''
    const chatId = message?.chat?.id

    if (!message || !chatId) return

    // Always ack to stop loading spinner
    try {
      await bot.answerCallbackQuery(cb.id)
    } catch {}

    // Handle /q param flow selections
    if (data.startsWith('q:')) {
      const userId = String(cb.from.id)

      if (data.startsWith('q:cat:')) {
        const category = data.split(':')[2]
        // Ask for difficulty next
        const prompt =
          '<b>How ambitious do you feel?</b>\n<i>Pick a difficulty to tailor the goal.</i>'
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}
        await bot.sendMessage(chatId, prompt, {
          parse_mode: 'HTML',
          reply_markup: buildDifficultyKeyboard(category),
        })
        return
      }

      if (data.startsWith('q:diff:')) {
        const parts = data.split(':')
        const category = parts[2]
        const difficulty = parts[3]
        try {
          await ensureBackendConfigured()
          ensureAccessTokenForUser(userId)

          const suggestions = await GoalsService.goalsControllerParamSuggestions({
            type: 'MACRO',
            category: category as any,
            difficulty: difficulty as any,
          })

          // Clear the difficulty keyboard to reduce clutter
          try {
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: chatId, message_id: message.message_id },
            )
          } catch {}

          await renderParamSuggestions(bot, chatId, suggestions, 'Great! Here are some options:')
        } catch (err: any) {
          const errMsg = err?.response?.data || err?.message || 'Failed to get suggestions.'
          await bot.sendMessage(
            chatId,
            typeof errMsg === 'string' ? errMsg : 'Failed to get suggestions.',
          )
        }
        return
      }
    }

    // Handle suggestion actions
    if (data.startsWith('suggest:')) {
      const userId = String(cb.from.id)

      if (data.startsWith('suggest:choose:')) {
        const idxStr = data.split(':')[2]
        const idx = Number.parseInt(idxStr, 10)
        if (!Number.isFinite(idx)) {
          await bot.sendMessage(chatId, 'Invalid selection.')
          return
        }

        const suggestions = getSuggestionsForMessage(chatId, message.message_id) || []
        const chosen = suggestions[idx]
        if (!chosen) {
          await bot.sendMessage(
            chatId,
            'That option has expired. Please request suggestions again.',
          )
          return
        }

        try {
          await ensureBackendConfigured()
          ensureAccessTokenForUser(userId)

          const body: CreateGoalDto = {
            type: chosen.type as any,
            category: chosen.category as any,
            difficulty: chosen.difficulty as any,
            text: chosen.text,
          }

          const created = await GoalsService.goalsControllerCreate({ requestBody: body })

          // Remove keyboard to prevent duplicate submissions
          try {
            await bot.editMessageReplyMarkup(
              { inline_keyboard: [] },
              { chat_id: chatId, message_id: message.message_id },
            )
          } catch {}

          clearSuggestionsForMessage(chatId, message.message_id)

          const confirm = `✅ Goal created: ${created.text}`
          await bot.sendMessage(chatId, confirm)
        } catch (err: any) {
          const errMsg = err?.response?.data || err?.message || 'Failed to create goal.'
          await bot.sendMessage(
            chatId,
            typeof errMsg === 'string' ? errMsg : 'Failed to create goal.',
          )
        }
        return
      }

      if (data === 'suggest:refine') {
        // Behave like /t: set lastAction to 't' and prompt user for free-form text
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: {
            lastAction: 't',
            flowId: '',
          },
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
        // Clean old keyboard to reduce clutter
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}

        const header =
          '<b>Get a personalised goal</b>\n' +
          '<i>Describe what goal you would like to achieve?</i>'
        await bot.sendMessage(chatId, header, { parse_mode: 'HTML' })
        return
      }
      if (data === 'suggest:select') {
        // Show genericSuggestions stored alongside the original message's suggestions
        const bundle = getSuggestionBundleForMessage(chatId, message.message_id)
        const generic = bundle?.genericSuggestions || []
        if (!generic.length) {
          await bot.sendMessage(chatId, 'No additional suggestions available right now.')
          return
        }
        // Clear the previous keyboard to reduce clutter
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}

        await renderParamSuggestions(bot, chatId, generic, 'Here are more options:')
        return
      }
    }

    // Other callback types can be handled here as needed
  } catch (err) {
    if (cb.id) {
      try {
        await bot.answerCallbackQuery(cb.id, { text: 'An error occurred.' })
      } catch {}
    }
    if (cb.message?.chat?.id) {
      await bot.sendMessage(
        cb.message.chat.id,
        'Sorry, something went wrong handling your selection.',
      )
    }
  }
})

// Export bot for potential external usage
export { bot }
