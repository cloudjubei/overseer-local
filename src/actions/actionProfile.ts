import TelegramBot, { Message, SendMessageOptions } from 'node-telegram-bot-api'
import { ProfilesService, UserProfileModel } from 'src/generated/backend'
import { getSession, setSession } from 'src/lib/sessionStore'
import actionLifestyle from './actionLifestyle'

// Profile onboarding steps in order
type ProfileStep = 'name' | 'dob' | 'gender' | 'metrics' | 'done'

function nextMissingStep(p: UserProfileModel | undefined | null): ProfileStep {
  if (!p) return 'name'
  if (!p.name || !p.name.trim()) return 'name'
  if (!p.dob) return 'dob'
  if (!p.gender) return 'gender'
  const hasWeight = typeof p.weight === 'number' || !!p.weight_raw
  const hasHeight = typeof p.height === 'number' || !!p.height_raw
  if (!hasWeight || !hasHeight) return 'metrics'
  return 'done'
}

function setProfileStep(userId: string, step: ProfileStep) {
  const prev = getSession(userId)
  setSession({
    ...(prev || { userId }),
    accessToken: prev?.accessToken || '',
    idToken: prev?.idToken,
    refreshToken: prev?.refreshToken,
    expiresAt: prev?.expiresAt,
    conversationState: {
      lastAction: 'profile',
      flowId: 'profile',
      ...(prev?.conversationState || {}),
      context: {
        ...(prev?.conversationState?.context || {}),
        profileStep: step,
      },
      lastUpdatedAt: Math.floor(Date.now() / 1000),
    },
  })
}

function clearProfileStep(userId: string) {
  const prev = getSession(userId)
  if (!prev) return
  // Clear only if the active flow is profile
  if (prev.conversationState?.lastAction === 'profile') {
    setSession({
      ...prev,
      conversationState: null,
      accessToken: prev?.accessToken || '',
      idToken: prev?.idToken,
      refreshToken: prev?.refreshToken,
      expiresAt: prev?.expiresAt,
    })
  }
}

function parseAge(input: string): number | null {
  // Accept formats like: 46, 46y, 46yo, 46 yrs, 46 years, age 46, I'm 46
  const trimmed = (input || '').toLowerCase().replace(/[,\.]/g, ' ').trim()
  const match = trimmed.match(/\b(\d{1,3})\b/)
  if (!match) return null
  const age = parseInt(match[1], 10)
  if (!Number.isFinite(age)) return null
  if (age < 1 || age > 120) return null
  return age
}

function dobFromAgeAsIso(age: number): string {
  const now = new Date()
  const y = now.getUTCFullYear() - age
  const m = now.getUTCMonth() // 0-11
  const d = now.getUTCDate() // 1-31
  // Construct at midnight UTC to avoid TZ ambiguity
  const dt = new Date(Date.UTC(y, m, d, 0, 0, 0, 0))
  return dt.toISOString()
}

async function promptForStep(bot: TelegramBot, chatId: number, step: ProfileStep) {
  const opts: SendMessageOptions = { parse_mode: 'HTML' }
  switch (step) {
    case 'name':
      // Updated per new spec: explicitly ask for the user's name
      await bot.sendMessage(chatId, 'Please tell us your name', opts)
      return
    case 'dob':
      await bot.sendMessage(
        chatId,
        '<b>Age</b>\nWhat is your age? You can reply with just a number (e.g., <code>46</code>).',
        opts,
      )
      return
    case 'gender': {
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Male', callback_data: 'profile:gender:MALE' },
            { text: 'Female', callback_data: 'profile:gender:FEMALE' },
            { text: 'Other', callback_data: 'profile:gender:OTHER' },
          ],
        ],
      }
      await bot.sendMessage(chatId, '<b>Gender</b>\nPlease select your gender:', {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      })
      return
    }
    case 'metrics':
      await bot.sendMessage(
        chatId,
        'Please tell me your weight and height (e.g., 77 kg, 178 cm).',
        {},
      )
      return
    case 'done':
    default:
      return
  }
}

export default async function actionProfile(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  _msg: Message,
) {
  // Fetch latest profile
  const profile = await ProfilesService.profilesControllerMe()
  const userId = String(from.id)

  // Always compute current step from backend state to avoid stale session after callbacks
  let step: ProfileStep = nextMissingStep(profile)

  // If profile is complete, clear any profile session and move on
  if (step === 'done') {
    clearProfileStep(userId)
    await actionLifestyle(bot, chat, from, rawText, _msg)
    return true
  }

  // Handler per-step for user input
  const text = (rawText || '').trim()

  if (step === 'name') {
    if (!text) {
      setProfileStep(userId, 'name')
      await promptForStep(bot, chat.id, 'name')
      return true
    }
    const name = text
    if (!name.trim()) {
      await bot.sendMessage(
        chat.id,
        '<b>Please enter a valid name.</b>\nTry again with plain text.',
        { parse_mode: 'HTML' },
      )
      return true
    }
    await ProfilesService.profilesControllerUpdate({ requestBody: { name: name.trim() } })
    await bot.sendMessage(chat.id, `Nice to meet you, <b>${escapeHtml(name.trim())}</b>.`, {
      parse_mode: 'HTML',
    })
    // fall through to next prompt
  }

  if (step === 'dob') {
    if (!text) {
      setProfileStep(userId, 'dob')
      await promptForStep(bot, chat.id, 'dob')
      return true
    }

    const age = parseAge(text)
    if (age === null) {
      await bot.sendMessage(
        chat.id,
        '<b>That does not look like an age.</b>\nPlease reply with a number like <code>46</code>.',
        { parse_mode: 'HTML' },
      )
      return true
    }

    const dobIso = dobFromAgeAsIso(age)

    await ProfilesService.profilesControllerUpdate({ requestBody: { dob: dobIso } })
    await bot.sendMessage(
      chat.id,
      `Got it — ${age}. Thanks, that helps me understand your stage in life 💪.`,
    )
    // fall through to next prompt
  }

  if (step === 'gender') {
    // Send inline keyboard and wait for callback
    setProfileStep(userId, 'gender')
    await promptForStep(bot, chat.id, 'gender')
    return true
  }

  if (step === 'metrics') {
    if (!text) {
      setProfileStep(userId, 'metrics')
      await promptForStep(bot, chat.id, 'metrics')
      return true
    }

    // Expect two values separated by a comma, e.g., '77 kg, 178 cm'
    const parts = text.split(',')
    if (parts.length < 2) {
      await bot.sendMessage(
        chat.id,
        'Please provide both weight and height separated by a comma, e.g., 77 kg, 178 cm.',
      )
      return true
    }

    const weightRaw = parts[0].trim()
    const heightRaw = parts.slice(1).join(',').trim() // in case user had commas in height format, join back

    const hasWeightNumber = /\d/.test(weightRaw)
    const hasHeightNumber = /\d/.test(heightRaw)

    if (!weightRaw || !heightRaw || !hasWeightNumber || !hasHeightNumber) {
      await bot.sendMessage(
        chat.id,
        'Please provide both weight and height in a clear format, e.g., 77 kg, 178 cm.',
      )
      return true
    }

    await ProfilesService.profilesControllerUpdate({
      requestBody: { weight_raw: weightRaw, height_raw: heightRaw },
    })

    await bot.sendMessage(chat.id, `Got it — ${weightRaw} / ${heightRaw}.`)
  }

  // After handling a step, compute next and prompt once
  const updated = await ProfilesService.profilesControllerMe()
  const next = nextMissingStep(updated)
  if (next === 'done') {
    clearProfileStep(userId)
    await actionLifestyle(bot, chat, from, rawText, _msg)
    return true
  } else {
    setProfileStep(userId, next)
    await promptForStep(bot, chat.id, next)
    return true
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\"/g, '&quot;')
    .replace(/\"/g, '&quot;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
