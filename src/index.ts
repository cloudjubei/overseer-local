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
import actionJournalAudio, { actionJournal } from './actions/actionJournal'
import actionProfile from './actions/actionProfile'
import actionLifestyle from './actions/actionLifestyle'
import actionMacroGoal from './actions/actionMacroGoal'
import actionMicroGoalsGenerate from './actions/actionMicroGoalsGenerate'
import { ProfilesService, UserProfileModel } from './generated/backend'
import { GoalModel } from './generated/backend/models/GoalModel'

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
    // NOTE: command-based /profile and /newgoal handlers removed per new spec
  ],
  { scope: { type: 'all_private_chats' } },
)
bot.on('chat_member', async (member: ChatMemberUpdated) => {
  console.log('chat_member updated: ', member)
})
bot.on('my_chat_member', async (member: ChatMemberUpdated) => {
  console.log('chat_member updated: ', member)
})

function isProfileComplete(p: UserProfileModel | undefined | null): boolean {
  if (!p) return false
  const hasName = !!(p.name && p.name.trim())
  const hasDob = !!p.dob
  const hasGender = !!p.gender
  const hasWeight = typeof p.weight === 'number' || !!p.weight_raw
  const hasHeight = typeof p.height === 'number' || !!p.height_raw
  return hasName && hasDob && hasGender && hasWeight && hasHeight
}

async function runOnboardingIfNeeded(
  bot: TelegramBot,
  msg: Message,
  rawText: string,
): Promise<boolean> {
  const { chat, from } = msg
  if (!from || !chat) return false
  const userId = String(from.id)

  // Ensure backend client is configured with current user's token
  await ensureBackendConfigured()
  ensureAccessTokenForUser(userId)

  // 1) Profile completeness
  try {
    const profile = await ProfilesService.profilesControllerMe()

    if (!isProfileComplete(profile)) {
      // Trigger profile setup flow
      await actionProfile(bot, chat, from, rawText, msg)
      return true
    }

    // 2) Lifestyle: require at least 1
    if (!Array.isArray(profile.lifestyles) || profile.lifestyles.length < 1) {
      await actionLifestyle(bot, chat, from, rawText, msg)
      return true
    }
  } catch (e) {
    // If fetching profile fails, do not proceed with onboarding in this tick
    return false
  }

  // 3) Macro goal: ensure there is an active MACRO goal
  try {
    const list = await GoalsService.goalsControllerList({ limit: 20 })
    const hasActiveMacro = (list.items || []).some(
      (g) => g.type === GoalModel.type.MACRO && g.state === GoalModel.state.ACTIVE,
    )
    if (!hasActiveMacro) {
      await actionMacroGoal(bot, chat, from, rawText, msg, true)
      return true
    }
  } catch (e) {
    // If listing goals fails, do not proceed further here
    return false
  }

  // 4) Micro goals: if no ACTIVE micro goals, generate new ones
  try {
    const activeMicro = await GoalsService.goalsControllerListMicroGoalsByState({
      state: 'ACTIVE',
    })
    if (!activeMicro || activeMicro.length === 0) {
      await actionMicroGoalsGenerate(bot, chat, from, rawText, msg)
      return true
    }
  } catch (e) {
    // If listing micro goals fails, do not block other handlers
    return false
  }

  // Onboarding complete
  return false
}

bot.on('message', async (msg: Message) => {
  try {
    const { chat, from } = msg
    if (!from || !chat) return

    const rawText = (msg.text || '').trim()

    const userId = String(from.id)
    const session = getSession(userId)

    // 0) Handle authentication first
    if (await handleAuthMessage(bot, msg)) return

    // New state-driven onboarding flow
    const handledOnboarding = await runOnboardingIfNeeded(bot, msg, rawText)
    if (handledOnboarding) return

    const hasResponse = rawText.lastIndexOf('‎')
    console.log('RAW TEXT: ', rawText)

    // Optional suggestion flows and journaling features
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

    // Handle profile gender selection
    if (data.startsWith('profile:gender:')) {
      const genderKey = data.split(':')[2] as keyof typeof UserProfileModel.gender
      const userId = String(cb.from.id)
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(userId)
        // Update profile gender
        await ProfilesService.profilesControllerUpdate({
          requestBody: { gender: UserProfileModel.gender[genderKey] as any },
        })
        const pretty = genderKey.charAt(0) + genderKey.slice(1).toLowerCase()
        await bot.sendMessage(chatId, `Gender set to ${pretty}.`)
      } catch (err) {
        await bot.sendMessage(chatId, 'Failed to update gender. Please try again.')
      }
      // Continue profile flow to next step
      try {
        await actionProfile(bot, message.chat, cb.from, '', message)
      } catch {}
      return
    }

    // Handle lifestyle selections
    if (data.startsWith('lifestyle:')) {
      const userId = String(cb.from.id)
      const parts = data.split(':')
      const kind = parts[1] // 'active' | 'energy'
      const valStr = parts[2]
      const val = Math.max(1, Math.min(5, parseInt(valStr || '0', 10)))

      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(userId)
      } catch {}

      const prev = getSession(userId)
      const prevCtx = prev?.conversationState?.context || {}
      const newCtx = { ...prevCtx }
      if (kind === 'active') newCtx.lifestyleActive = val
      if (kind === 'energy') newCtx.lifestyleEnergy = val

      setSession({
        ...(prev || { userId }),
        accessToken: prev?.accessToken || '',
        idToken: prev?.idToken,
        refreshToken: prev?.refreshToken,
        expiresAt: prev?.expiresAt,
        conversationState: {
          lastAction: 'lifestyle',
          flowId: 'lifestyle',
          ...(prev?.conversationState || {}),
          context: newCtx,
          lastUpdatedAt: Math.floor(Date.now() / 1000),
        },
      })

      // Continue lifestyle flow
      try {
        await actionLifestyle(bot, message.chat, cb.from, '', message)
      } catch {}
      return
    }

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
