import TelegramBot, { CallbackQuery, ChatMemberUpdated, Message } from 'node-telegram-bot-api'
import { config } from './config/env'
import {
  handleAuthMessage,
  ensureBackendConfigured,
  ensureAccessTokenForUser,
  getTelegramUserId,
} from './lib/auth'
import { getSession, setSession, isAuthenticated, clearSession } from './lib/sessionStore'
import { GoalsService } from './generated/backend/services/GoalsService'
import { initScheduler } from './lib/scheduler'
import actionJournalAudio, {
  actionJournal,
  processAudioJournal,
  processTextJournal,
} from './actions/actionJournal'
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
import actionMicroGoalsCheck, {
  buildMicroCheckKeyboard,
  buildMicroCheckMessage,
  clearStoredMicroCheck,
  getStoredMicroCheck,
  setStoredMicroCheck,
  toggleMicroGoalState,
} from './actions/actionMicroGoalsCheck'
import { handleWeeklyResetCallback } from './actions/actionWeeklyReset'
import { sleep } from './lib/time'

const bot = new TelegramBot(config.telegramBotToken, { polling: true })
initScheduler(bot)

bot.setMyCommands(
  [
    { command: 'start', description: 'Start the flow' },
    { command: 'journal', description: 'Create a text journal note' },
    { command: 'voice', description: 'Create an audio journal note' },
    // { command: 'testevening', description: 'Trigger evening micro-goal check (test)' },
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

  try {
    const profile = await ProfilesService.profilesControllerMe()

    if (!isProfileComplete(profile)) {
      await actionProfile(bot, chat, from, rawText, msg)
      return true
    }

    if (!Array.isArray(profile.lifestyles) || profile.lifestyles.length < 1) {
      await actionLifestyle(bot, chat, from, rawText, msg)
      return true
    }
  } catch (e) {
    return false
  }

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
    const userId = String(from.id)
    const session = getSession(userId)
    // clearSession(userId)

    // Handle journal entry after micro-goals check-in
    if (session?.conversationState?.lastAction === 'awaiting_journal_entry') {
      if (msg.voice || msg.audio) {
        await processAudioJournal(bot, chat, from, msg)
      } else if (msg.text) {
        await processTextJournal(bot, chat, from, rawText)
      }
      return // Handled
    }

    const handledAuth = await handleAuthMessage(bot, msg)
    if (handledAuth) {
      // If the message was handled by auth and the user is now authenticated, immediately start onboarding
      const uid = getTelegramUserId(msg)
      if (uid && isAuthenticated(uid)) {
        const started = await runOnboardingIfNeeded(bot, msg, '')
        if (started) return
      }
      return
    }

    const handledOnboarding = await runOnboardingIfNeeded(bot, msg, rawText)
    if (handledOnboarding) return

    // Test command to trigger evening micro-goal check flow
    if (rawText === '/testevening' || rawText.startsWith('/testevening ')) {
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(String(from.id))
      } catch {}
      await actionMicroGoalsCheck(bot, chat, from, rawText, msg)
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

function todayStamp(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

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

    // Handle journal audio confirmation actions
    if (data.startsWith('journal:audio:')) {
      const userId = String(cb.from.id)
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(userId)
      } catch {}

      // Remove the inline keyboard from the confirmation message
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: message.message_id },
        )
      } catch {}

      if (data.includes(':submit:')) {
        // Confirm saved and clear any pending state
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
          conversationState: null,
        })
        await bot.sendMessage(chatId, 'Journal entry saved ✅.')
        return
      }

      if (data.includes(':rerecord:')) {
        // Prompt user to re-record and set state to accept new voice
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
          conversationState: {
            lastAction: 'voice',
            flowId: '',
            lastUpdatedAt: Math.floor(Date.now() / 1000),
          },
        })

        const header = '<b>Take a minute to reflect - how’s today been so far?</b>\n'
        await bot.sendMessage(chatId, header, { parse_mode: 'HTML' })
        return
      }
    }

    // NEW: Handle macro voice entry trigger
    if (data === 'macro:suggest:voice') {
      // Remove inline keyboard from the suggestion message
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: message.message_id },
        )
      } catch {}

      await bot.sendMessage(
        chatId,
        "Great — tap and hold the mic to share a quick voice note about what you want to focus on this week. I'll turn it into a clear goal.",
      )
      return
    }

    // For macro suggestion selections, handle numeric choice
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

      const journalPrompt =
        'Take a moment to reflect — how did today actually feel? You can share a few words or drop a quick voice note.'

      const setAwaitingJournalState = () => {
        const userId = String(cb.from.id)
        const prev = getSession(userId)
        setSession({
          ...(prev || { userId }),
          conversationState: {
            lastAction: 'awaiting_journal_entry',
            flowId: '',
          },
          accessToken: prev?.accessToken || '',
          idToken: prev?.idToken,
          refreshToken: prev?.refreshToken,
          expiresAt: prev?.expiresAt,
        })
      }

      // microcheck:finish -> close the UI
      if (data === 'microcheck:finish') {
        try {
          await bot.editMessageReplyMarkup(
            { inline_keyboard: [] },
            { chat_id: chatId, message_id: message.message_id },
          )
        } catch {}
        const allMicro = getStoredMicroCheck(chatId, message.message_id) ?? []
        const doneMicro = allMicro.filter((g) => g.state === GoalModel.state.SUCCESS)
        clearStoredMicroCheck(chatId, message.message_id)

        let goalsCompletionMessage = ` let\'s set our sights for tomorrow!`
        if (doneMicro.length == 2) {
          goalsCompletionMessage = ' almost perfect! Keep it up!'
        } else if (doneMicro.length == 1) {
          goalsCompletionMessage = ' good start! Tomorrow can only get better!'
        }

        await bot.sendMessage(
          chatId,
          `${doneMicro.length}/${allMicro.length} goals done - ${goalsCompletionMessage}`,
        )

        try {
          const profile = await ProfilesService.profilesControllerMe()
          const lifestyles = Array.isArray(profile?.lifestyles) ? profile.lifestyles : []
          const latest = lifestyles.length > 0 ? lifestyles[lifestyles.length - 1] : undefined
          const motivationTextEvening =
            typeof latest?.motivationTextEvening === 'string'
              ? latest.motivationTextEvening.trim()
              : ''
          if (motivationTextEvening) {
            await bot.sendMessage(chatId, motivationTextEvening)
            await sleep(2000)
          }
        } catch {}

        await sleep(2000)

        await bot.sendMessage(chatId, journalPrompt)
        setAwaitingJournalState()
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
          // Deduplicate
          const unique: { [id: string]: boolean } = {}
          const deduped = mapped.filter((g) => (unique[g.id] ? false : (unique[g.id] = true)))
          store = deduped
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

      const allDone = store.every((g) => g.state === GoalModel.state.SUCCESS)

      if (allDone) {
        // All goals are checked, show prompt and set state
        try {
          const finalText = buildMicroCheckMessage(store)
          await bot.editMessageText(finalText, {
            chat_id: chatId,
            message_id: message.message_id,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }, // remove keyboard
          })
        } catch {}

        clearStoredMicroCheck(chatId, message.message_id)

        await bot.sendMessage(
          chatId,
          `${store.length}/${store.length} goals done - amazing work! Keep it up!`,
        )

        try {
          const profile = await ProfilesService.profilesControllerMe()
          const lifestyles = Array.isArray(profile?.lifestyles) ? profile.lifestyles : []
          const latest = lifestyles.length > 0 ? lifestyles[lifestyles.length - 1] : undefined
          const motivationTextEvening =
            typeof latest?.motivationTextEvening === 'string'
              ? latest.motivationTextEvening.trim()
              : ''
          if (motivationTextEvening) {
            await bot.sendMessage(chatId, motivationTextEvening)
            await sleep(2000)
          }
        } catch {}

        await sleep(2000)

        await bot.sendMessage(chatId, journalPrompt)
        setAwaitingJournalState()
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
      return
    }

    if (data.startsWith('weekly_reset:')) {
      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(String(cb.from.id))
      } catch {}
      await handleWeeklyResetCallback(bot, cb)
      return
    }

    // Handle morning energy selection prior to generating micro goals
    if (data.startsWith('morning:energy:')) {
      const userId = String(cb.from.id)
      const parts = data.split(':')
      const val = Math.max(1, Math.min(5, parseInt(parts[2] || '0', 10)))

      try {
        await ensureBackendConfigured()
        ensureAccessTokenForUser(userId)
      } catch {}

      // Remove the inline keyboard on the energy prompt
      try {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: message.message_id },
        )
      } catch {}

      const prev = getSession(userId)
      const prevCtx = prev?.conversationState?.context || {}
      const nowStamp = todayStamp()
      const newCtx = { ...prevCtx, morningEnergy: val, morningEnergyDate: nowStamp }

      setSession({
        ...(prev || { userId }),
        accessToken: prev?.accessToken || '',
        idToken: prev?.idToken,
        refreshToken: prev?.refreshToken,
        expiresAt: prev?.expiresAt,
        conversationState: {
          lastAction: 'morning_energy',
          flowId: 'morning_energy',
          ...(prev?.conversationState || {}),
          context: newCtx,
          lastUpdatedAt: Math.floor(Date.now() / 1000),
        },
      })

      const energyLabels: Record<number, { emoji: string; label: string }> = {
        1: {
          emoji: '😴',
          label: 'Sounds like energy’s a little too low — let’s see if we can lift that this week.',
        },
        2: {
          emoji: '😐',
          label: 'Sounds like energy’s a little low — let’s see if we can lift that this week.',
        },
        3: {
          emoji: '🙂',
          label: 'You`re on the right track - let’s see if we can lift that this week.',
        },
        4: { emoji: '😊', label: 'Sounds great 😊' },
        5: { emoji: '🤩', label: 'You sound pumped! Keep it up! 🤩' },
      }

      const m = energyLabels[val]
      if (m) {
        try {
          await bot.sendMessage(chatId, `${m.label}`)
          await sleep(2000)
        } catch {}
      }

      // Continue with micro goal generation now that energy is set
      try {
        await actionMicroGoalsGenerate(bot, message.chat, cb.from, '', message)
      } catch {}

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
        // add sleep of 2s
        await sleep(2000)
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
      const val = Math.max(1, Math.min(3, parseInt(valStr || '0', 10)))

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

      const activityLabels: Record<number, { emoji: string; label: string }> = {
        1: { emoji: '🛋️', label: 'Thanks, that helps me understand you better 💪.' },
        2: { emoji: '🏃', label: 'You sound in good shape already 👏.' },
        3: { emoji: '🔥', label: 'You sound in amazing shape already 👏👏.' },
      }
      const energyLabels: Record<number, { emoji: string; label: string }> = {
        1: {
          emoji: '😴',
          label: 'Sounds like energy’s a little low — let’s see if we can lift that this week.',
        },
        2: {
          emoji: '🙂',
          label: 'You`re on the right track - let’s see if we can lift that this week.',
        },
        3: { emoji: '🤩', label: 'Sounds great 😊' },
      }

      try {
        if (kind === 'active') {
          const m = activityLabels[val]
          if (m) {
            await bot.sendMessage(chatId, `${m.label}`)
            // add sleep of 2s
            await sleep(2000)
          }
        } else if (kind === 'energy') {
          const m = energyLabels[val]
          if (m) {
            await bot.sendMessage(chatId, `${m.label}.`)
            // add sleep of 2s
            await sleep(2000)
          }
        }
      } catch {}

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
