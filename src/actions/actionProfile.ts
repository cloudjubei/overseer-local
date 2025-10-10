import TelegramBot, { Message, SendMessageOptions } from 'node-telegram-bot-api'
import { ProfilesService, UserProfileModel } from 'src/generated/backend'
import { getSession, setSession } from 'src/lib/sessionStore'
import actionLifestyle from './actionLifestyle'

// Profile onboarding steps in order
type ProfileStep = 'name' | 'dob' | 'gender' | 'weight' | 'height' | 'done'

function nextMissingStep(p: UserProfileModel | undefined | null): ProfileStep {
  if (!p) return 'name'
  if (!p.name || !p.name.trim()) return 'name'
  if (!p.dob) return 'dob'
  if (!p.gender) return 'gender'
  const hasWeight = typeof p.weight === 'number' || !!p.weight_raw
  if (!hasWeight) return 'weight'
  const hasHeight = typeof p.height === 'number' || !!p.height_raw
  if (!hasHeight) return 'height'
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

function isValidDateYYYYMMDD(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false
  const [yStr, mStr, dStr] = input.split('-')
  const y = Number(yStr)
  const m = Number(mStr)
  const d = Number(dStr)
  if (y < 1900 || y > new Date().getFullYear()) return false
  if (m < 1 || m > 12) return false
  const dt = new Date(input + 'T00:00:00Z')
  if (Number.isNaN(dt.getTime())) return false
  // Ensure month/day align (e.g., reject 2023-02-30)
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d &&
    dt <= new Date()
  )
}

async function promptForStep(bot: TelegramBot, chatId: number, step: ProfileStep) {
  const opts: SendMessageOptions = { parse_mode: 'HTML' }
  switch (step) {
    case 'name':
      await bot.sendMessage(chatId, "<b>Let's set up your profile</b>\nWhat's your name?", opts)
      return
    case 'dob':
      await bot.sendMessage(
        chatId,
        '<b>Date of birth</b>\nPlease enter your date of birth in the format <code>YYYY-MM-DD</code>.',
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
    case 'weight':
      await bot.sendMessage(
        chatId,
        '<b>Weight</b>\nPlease tell us your weight (e.g., 82 kg, 180 lb, 11st 4lb).',
        opts,
      )
      return
    case 'height':
      await bot.sendMessage(
        chatId,
        "<b>Height</b>\nPlease tell us your height (e.g., 175 cm, 1.75 m, 5'11').",
        opts,
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
    if (!isValidDateYYYYMMDD(text)) {
      await bot.sendMessage(
        chat.id,
        "<b>That doesn't look right.</b>\nPlease enter your date in <code>YYYY-MM-DD</code> format (e.g., 1990-06-21).",
        { parse_mode: 'HTML' },
      )
      return true
    }
    await ProfilesService.profilesControllerUpdate({ requestBody: { dob: text } })
    await bot.sendMessage(chat.id, `Got it — DOB: <b>${text}</b>`, { parse_mode: 'HTML' })
    // fall through to next prompt
  }

  if (step === 'gender') {
    // Send inline keyboard and wait for callback
    setProfileStep(userId, 'gender')
    await promptForStep(bot, chat.id, 'gender')
    return true
  }

  if (step === 'weight') {
    if (!text) {
      setProfileStep(userId, 'weight')
      await promptForStep(bot, chat.id, 'weight')
      return true
    }
    const weightRaw = text
    if (!weightRaw.trim()) {
      await bot.sendMessage(
        chat.id,
        '<b>Please provide your weight</b>\nExamples: 82 kg, 180 lb, 11st 4lb.',
        { parse_mode: 'HTML' },
      )
      return true
    }
    await ProfilesService.profilesControllerUpdate({
      requestBody: { weight_raw: weightRaw.trim() },
    })
    await bot.sendMessage(
      chat.id,
      `Thanks — recorded weight: <b>${escapeHtml(weightRaw.trim())}</b>`,
      {
        parse_mode: 'HTML',
      },
    )
    // fall through to next prompt
  }

  if (step === 'height') {
    if (!text) {
      setProfileStep(userId, 'height')
      await promptForStep(bot, chat.id, 'height')
      return true
    }
    const heightRaw = text
    if (!heightRaw.trim()) {
      await bot.sendMessage(
        chat.id,
        "<b>Please provide your height</b>\nExamples: 175 cm, 1.75 m, 5'11'.",
        { parse_mode: 'HTML' },
      )
      return true
    }
    await ProfilesService.profilesControllerUpdate({
      requestBody: { height_raw: heightRaw.trim() },
    })
    await bot.sendMessage(
      chat.id,
      `Great — recorded height: <b>${escapeHtml(heightRaw.trim())}</b>`,
      {
        parse_mode: 'HTML',
      },
    )
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
    .replace(/\"/g, '&quot;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
