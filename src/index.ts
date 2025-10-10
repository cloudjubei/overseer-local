import TelegramBot, { CallbackQuery, ChatMemberUpdated, Message } from 'node-telegram-bot-api'
import { config } from './config/env'
import { handleAuthMessage, ensureBackendConfigured, ensureAccessTokenForUser } from './lib/auth'
import { getSession, setSession } from './lib/sessionStore'
import audioSuggestionAction from './actions/audioSuggestion'
import { GoalsService } from './generated/backend/services/GoalsService'
import { initScheduler } from './lib/scheduler'
import actionJournalAudio, { actionJournal } from './actions/actionJournal'
import actionProfile from './actions/actionProfile'
import actionLifestyle from './actions/actionLifestyle'
import actionMacroGoal, {
  clearMacroSuggestionsForMessage,
  getMacroSuggestionsForMessage,
  processMacroInput,
} from './actions/actionMacroGoal'
import actionMicroGoalsGenerate from './actions/actionMicroGoalsGenerate'
import { ProfilesService, UserProfileModel } from './generated/backend'
import { GoalModel } from './generated/backend/models/GoalModel'
import {
  areAllGoalsAddressed,
  buildMicroCheckKeyboard,
  buildMicroCheckMessage,
  clearStoredMicroCheck,
  getStoredMicroCheck,
  setStoredMicroCheck,
  toggleMicroGoalState,
} from './actions/actionMicroGoalsCheck'

const bot = new TelegramBot(config.telegramBotToken, { polling: true })
initScheduler(bot)

bot.setMyCommands(
  [
    { command: 'start', description: 'Start the flow' },
    { command: 'journal', description: 'Create a text journal note' },
    { command: 'voice', description: 'Create an audio journal note' },
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
    const activeMicro = await GoalsService.goalsControllerListMicroGoalsByState({ state: 'ACTIVE' })
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

    // const userId = String(from.id)
    // const session = getSession(userId)
    if (await handleAuthMessage(bot, msg)) return

    const handledOnboarding = await runOnboardingIfNeeded(bot, msg, rawText)
    if (handledOnboarding) return

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

    // For macro suggestion selections, we need to handle before clearing the keyboard to retain message_id for lookup
    if (data.startsWith('macro:suggest:')) {
      const idxStr = data.split(':')[2]
      const idx = Number.parseInt(idxStr, 10)
      const suggestions = getMacroSuggestionsForMessage(chatId, message.message_id)
      const picked = suggestions[idx]

      // Clean keyboard after we extract
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: message.message_id },
        )
      } catch {}
      clearMacroSuggestionsForMessage(chatId, message.message_id)

      if (!picked) {
        await bot.sendMessage(chatId, 'Sorry, that suggestion is no longer available.')
        return
      }

      // Process macro goal creation using the picked suggestion's summary as text
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(String(cb.from.id))
      } catch {}

      const chat = message.chat
      await processMacroInput(bot, chat, cb.from, '', message, picked.summary)
      return
    }

    // Handle micro goals evening check-in inline toggles
    if (data.startsWith('microcheck:')) {
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(String(cb.from.id))
      } catch {}

      // microcheck:finish -> close the UI
      if (data === 'microcheck:finish') {
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}
        clearStoredMicroCheck(chatId, message.message_id)
        await bot.sendMessage(chatId, 'Great! Thanks for these responses.')
        return
      }

      // microcheck:<goalId>:toggle
      const parts = data.split(':')
      const goalId = parts[1]
      if (!goalId) return

      let store = getStoredMicroCheck(chatId, message.message_id)
      // Best-effort reconstruction if store is missing
      if (!store) {
        try {
          const active = await GoalsService.goalsControllerListMicroGoalsByState({
            state: 'ACTIVE',
          })
          const mapped = (active || [])
            .slice(0, 3)
            .map((g) => ({ id: g.id, text: g.text || '', state: g.state }))
          // Ensure the toggled goal is present
          if (!mapped.find((g) => g.id === goalId)) {
            try {
              const g = await GoalsService.goalsControllerGet({ id: goalId })
              mapped.unshift({ id: g.id, text: g.text || '', state: g.state })
            } catch {}
          }
          // Deduplicate and cap to 3
          const unique: { [id: string]: boolean } = {}
          const deduped = mapped.filter((g) => (unique[g.id] ? false : (unique[g.id] = true)))
          store = deduped.slice(0, 3)
          setStoredMicroCheck(chatId, message.message_id, store)
        } catch {}
      }

      if (!store) {
        await bot.sendMessage(chatId, 'This check-in is no longer active.')
        return
      }

      const target = store.find((g) => g.id === goalId)
      if (!target) {
        await bot.sendMessage(chatId, 'This goal is no longer available for check-in.')
        return
      }

      try {
        const newState = await toggleMicroGoalState(target)
        target.state = newState
      } catch (err) {
        await bot.sendMessage(chatId, 'Failed to update this goal. Please try again.')
        return
      }

      // Re-render the same message with updated state
      const newText = buildMicroCheckMessage(store)
      const newKeyboard = buildMicroCheckKeyboard(store)
      try {
        await bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: message.message_id,
          parse_mode: 'HTML',
          reply_markup: newKeyboard,
        })
      } catch {}

      // If all are addressed (not ACTIVE), close the flow automatically
      if (areAllGoalsAddressed(store)) {
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}
        clearStoredMicroCheck(chatId, message.message_id)
        await bot.sendMessage(chatId, 'Great! Thanks for these responses.')
      }
      return
    }

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
          requestBody: { gender: UserProfileModel.gender[genderKey] },
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
