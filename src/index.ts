import TelegramBot, { CallbackQuery, ChatMemberUpdated, Message } from 'node-telegram-bot-api'
import { config } from './config/env'
import { handleAuthMessage, ensureBackendConfigured, ensureAccessTokenForUser } from './lib/auth'
import { getSession, setSession } from './lib/sessionStore'
import { handleConversationMessage } from './conversations/conversationManager'
import { renderBackendPrompt } from './conversations/promptRenderer'
import testAction from './actions/test'
import testLLMAction from './actions/testLLM'
import quickSuggestionAction, {
  chooseSuggestion,
  quickSuggestionAction2,
} from './actions/quickSuggestion'
import audioSuggestionAction from './actions/audioSuggestion'
import { GoalsService } from './generated/backend/services/GoalsService'
import { getSuggestionBundleForMessage } from './actions/suggestionState'
import { renderParamSuggestions } from './actions/suggestionRenderer'
import { textSuggestionActionMacro } from './actions/textSuggestion'
import {
  sendCategoryKeyboardMessage,
  sendDifficultyKeyboardMessage,
  sendTypeKeyboardMessage,
} from './common/keyboards'
import { initScheduler } from './lib/scheduler'
import profileAction from './actions/actionProfile'
import actionJournalAudio, { actionJournal } from './actions/actionJournal'
import { GoalModel } from './generated/backend'
import actionProfile from './actions/actionProfile'
import actionLifestyle from './actions/actionLifestyle'

const bot = new TelegramBot(config.telegramBotToken, { polling: true })
initScheduler(bot)

bot.setMyCommands(
  [
    // { command: 'start', description: 'Start the bot' },
    // { command: 'help', description: 'Show the help message' },
    { command: 'q', description: 'Pick a suggestion from a list V1' },
    { command: 'q2', description: 'Pick a suggestion from a list V2' },
    // { command: 'micro', description: 'Create a Micro Goal suggestion via AI (text) V1' },
    { command: 'macro', description: 'Create a Macro Goal suggestion via AI (text) V2' },
    { command: 's', description: 'Create a Macro Goal suggestion via AI (sound)' },
    { command: 'journal', description: 'Create a text journal note' },
    { command: 'audio', description: 'Create an audio journal note' },
    // { command: 'profile', description: 'Setup your profile' },
  ],
  { scope: { type: 'all_private_chats' } },
)
bot.on('chat_member', async (member: ChatMemberUpdated) => {
  console.log('chat_member updated: ', member)
})
bot.on('my_chat_member', async (member: ChatMemberUpdated) => {
  console.log('chat_member updated: ', member)
})

bot.on('message', async (msg: Message) => {
  try {
    const { chat, from } = msg
    if (!from || !chat) return

    const rawText = (msg.text || '').trim()

    const userId = String(from.id)
    const session = getSession(userId)

    if (await handleAuthMessage(bot, msg)) return

    if (await actionProfile(bot, chat, from, rawText, msg)) {
      return
    }
    if (await actionLifestyle(bot, chat, from, rawText, msg)) {
      return
    }

    const hasResponse = rawText.lastIndexOf('‎')
    console.log('RAW TEXT: ', rawText)
    // console.log('HAS RESPONSE: ', hasResponse)
    // if (await quickSuggestionAction2(bot, chat, from, rawText, msg.message_id, hasResponse)) {
    //   return
    // }
    // if (await quickSuggestionAction(bot, chat, from, rawText, msg)) {
    //   return
    // }
    if (await textSuggestionActionMacro(bot, chat, from, rawText, msg.message_id, hasResponse)) {
      return
    }
    if (await audioSuggestionAction(bot, chat, from, rawText, msg)) {
      return
    }
    if (await actionJournal(bot, chat, from, rawText)) {
      return
    }
    if (await actionJournalAudio(bot, chat, from, rawText, msg)) {
      return
    }
  } catch (err) {
    if (msg.chat?.id) {
      await bot.sendMessage(msg.chat.id, 'Sorry, something went wrong handling your message.')
    }
  }
})

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
    //reset previous keyboard
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: message.message_id },
      )
    } catch {}

    // Handle /q param flow selections
    if (data.startsWith('q:')) {
      const userId = String(cb.from.id)

      if (data.startsWith('q:type:cat:diff:')) {
        const parts = data.split(':')
        const type = parts[4]
        const category = parts[5]
        const difficulty = parts[6]
        try {
          await ensureBackendConfigured()
          ensureAccessTokenForUser(userId)

          const suggestions = await GoalsService.goalsControllerParamSuggestions({
            type: type as any,
            category: category as any,
            difficulty: difficulty as any,
          })

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
      if (data.startsWith('q:type:cat:')) {
        const parts = data.split(':')
        const type = parts[3]
        const category = parts[4]

        await sendDifficultyKeyboardMessage(bot, chatId, type, category, true)
        return
      }
      if (data.startsWith('q:type:')) {
        const parts = data.split(':')
        const type = parts[2]

        await sendCategoryKeyboardMessage(bot, chatId, type, true)
        return
      }

      //start the flow again

      //TODO: skip typ for now
      await sendCategoryKeyboardMessage(bot, chatId, GoalModel.type.MACRO, true)
      // await sendTypeKeyboardMessage(bot, chatId, true)
      return
    }

    // Handle suggestion actions
    if (data.startsWith('suggest:')) {
      const userId = String(cb.from.id)

      if (data.startsWith('suggest:choose:')) {
        const idxStr = data.split(':')[2]
        const idx = Number.parseInt(idxStr, 10)
        await chooseSuggestion(bot, chatId, userId, message.message_id, idx)
        return
      }

      if (data === 'suggest:refine') {
        // Behave like /t: set lastAction to 'macro' and prompt user for free-form text
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: {
            lastAction: 'macro',
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
