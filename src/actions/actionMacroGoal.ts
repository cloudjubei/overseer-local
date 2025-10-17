import TelegramBot, { Message } from 'node-telegram-bot-api'
import {
  CheckInModel,
  CheckInsService,
  GoalModel,
  GoalsService,
  GoalSuggestedModel,
} from 'src/generated/backend'
import { downloadTelegramAudioFile } from 'src/lib/files'
import actionMicroGoalsGenerate from './actionMicroGoalsGenerate'
import { sleep } from 'src/lib/time'

// In-memory store to map suggestion lists per message for callback selections
// Keyed by `${chatId}:${messageId}` -> suggestions array
const macroSuggestionStore = new Map<string, GoalSuggestedModel[]>()

function keyFor(chatId: number, messageId: number) {
  return `${chatId}:${messageId}`
}

function nextLocalTime(hour: number, minute = 0): Date {
  const now = new Date()
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0)
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target
}

async function scheduleCheckIns(chatId: number) {
  const morning = nextLocalTime(9, 0)
  const evening = nextLocalTime(19, 0)

  // Do not clear here; we already cleared in processMacroInput per acceptance criteria

  await CheckInsService.checkInsControllerAddCheckIn({
    requestBody: {
      start: morning.toISOString(),
      frequency: CheckInModel.frequency.DAILY,
      metadata: {
        message: '<b>Morning Reminder!</b>',
        action: 'micro_goals_generate',
        chatId: chatId,
      },
    },
  })

  await CheckInsService.checkInsControllerAddCheckIn({
    requestBody: {
      start: evening.toISOString(),
      frequency: CheckInModel.frequency.DAILY,
      metadata: {
        message: '<b>Evening Check in!</b>',
        action: 'micro_goals_check',
        chatId: chatId,
      },
    },
  })

  const weeklyResetTime = new Date()
  weeklyResetTime.setDate(weeklyResetTime.getDate() + 7)
  weeklyResetTime.setHours(20, 0, 0, 0)

  await CheckInsService.checkInsControllerAddCheckIn({
    requestBody: {
      start: weeklyResetTime.toISOString(),
      frequency: CheckInModel.frequency.WEEKLY,
      metadata: {
        action: 'weekly_reset',
        chatId: chatId,
      },
    },
  })
}

export default async function actionMacroGoal(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
  firstGoal: boolean = false,
) {
  const chatId = chat.id

  const hasVoice = !!msg.voice || !!msg.audio
  const hasText = !!rawText && rawText.trim().length > 0

  // If user sent free text or voice, treat as custom macro (skip suggestions)
  if (hasVoice || hasText) {
    await processMacroInput(bot, chat, from, rawText, msg)
    return true
  }

  await bot.sendMessage(chatId, '🧭 Weekly direction')
  await sleep(2000)

  const header =
    'What’s something that really matters to you right now — maybe around your health, focus, or wellbeing?\nYou can type it in or send a voice message.\n\nHere are a few ideas if you need inspiration:'

  // Static suggestions (do not call backend)
  const suggestions: GoalSuggestedModel[] = [
    {
      type: GoalSuggestedModel.type.MACRO,
      category: GoalSuggestedModel.category.FITNESS,
      difficulty: GoalSuggestedModel.difficulty.EASY,
      text: 'Get fitter 💪',
      summary: 'Get fitter 💪',
    },
    {
      type: GoalSuggestedModel.type.MACRO,
      category: GoalSuggestedModel.category.SLEEP,
      difficulty: GoalSuggestedModel.difficulty.EASY,
      text: 'Sleep better 😴',
      summary: 'Sleep better 😴',
    },
    {
      type: GoalSuggestedModel.type.MACRO,
      category: GoalSuggestedModel.category.OTHER,
      difficulty: GoalSuggestedModel.difficulty.EASY,
      text: 'Be more mindful 🧘',
      summary: 'Be more mindful 🧘',
    },
    {
      type: GoalSuggestedModel.type.MACRO,
      category: GoalSuggestedModel.category.STRESS,
      difficulty: GoalSuggestedModel.difficulty.EASY,
      text: 'Manage stress ⚡',
      summary: 'Manage stress ⚡',
    },
  ]

  // Build inline keyboard with 2 options per row and a final voice-note button
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  // First two rows (2 per line)
  for (let i = 0; i < 4; i += 2) {
    const a = suggestions[i]
    const b = suggestions[i + 1]
    const row: TelegramBot.InlineKeyboardButton[] = [
      { text: a.summary, callback_data: `macro:suggest:${i}` },
    ]
    if (b) row.push({ text: b.summary, callback_data: `macro:suggest:${i + 1}` })
    rows.push(row)
  }
  // Final button to trigger voice entry
  rows.push([{ text: '🎙️ Voice note (custom goal)', callback_data: 'macro:suggest:voice' }])

  const sent = await bot.sendMessage(chatId, header, {
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: rows },
  })

  // Save for subsequent selection mapping (used by callback handler)
  macroSuggestionStore.set(keyFor(chatId, sent.message_id), suggestions)

  // No immediate input to process; wait for user reply/selection or voice/text
  return false
}

export async function processMacroInput(
  bot: TelegramBot,
  chat: TelegramBot.Chat,
  from: TelegramBot.User,
  rawText: string,
  msg: Message,
  pickedSuggestionText?: string,
) {
  const chatId = chat.id
  // Inform user we're processing and remove the suggestion keyboard immediately
  const processingMsg = await bot.sendMessage(chatId, 'Processing...', {
    reply_markup: { remove_keyboard: true },
  })

  try {
    // Always clear existing check-ins prior to creating a new macro context
    await CheckInsService.checkInsControllerClearCheckIns()

    let created: GoalModel | null = null

    // Priority: if a suggestion text was provided via selection
    if (pickedSuggestionText && pickedSuggestionText.trim()) {
      created = await GoalsService.goalsControllerCreateMacroGoalFromText({
        requestBody: { text: pickedSuggestionText.trim() },
      })
    } else if (msg.voice || msg.audio) {
      const fileId = msg.voice?.file_id || msg.audio?.file_id
      if (!fileId) throw new Error('Missing audio file id')
      const { blob } = await downloadTelegramAudioFile(bot, fileId)
      created = await GoalsService.goalsControllerCreateMacroGoalFromAudio({
        formData: { file: blob },
      })
    } else if (rawText && rawText.trim()) {
      // Strip any hidden-prefix characters if the user typed or pasted them accidentally
      const cleaned = rawText.replace(/^‎+/, '')
      created = await GoalsService.goalsControllerCreateMacroGoalFromText({
        requestBody: { text: cleaned.trim() },
      })
    }

    await scheduleCheckIns(chatId)

    await bot.sendMessage(
      chatId,
      'Here’s the plan — I’ll share three tiny steps each morning to keep your momentum building.\n\nIn the evening, I’ll check in to see how things went.',
    )

    await actionMicroGoalsGenerate(bot, chat, from, '', msg)
  } catch (e) {
    console.error('ActionMacroGoal error: ', e)
    await bot.sendMessage(chatId, 'Sorry, I could not create your macro goal. Please try again.')
  } finally {
    try {
      await bot.deleteMessage(chatId, processingMsg.message_id)
    } catch {}
  }
}

export function getMacroSuggestionsForMessage(chatId: number, messageId: number) {
  return macroSuggestionStore.get(keyFor(chatId, messageId)) || []
}
export function clearMacroSuggestionsForMessage(chatId: number, messageId: number) {
  macroSuggestionStore.delete(keyFor(chatId, messageId))
}
