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

function buildMacroSuggestionKeyboard(
  suggestions: GoalSuggestedModel[],
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []
  suggestions.forEach((sug, idx) => {
    const n = idx + 1
    rows.push([
      {
        text: `${n} • ${sug.summary}`,
        callback_data: `macro:suggest:${idx}`,
      },
    ])
  })
  return { inline_keyboard: rows }
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

  // If the current message already carries input (audio or text), process it immediately
  const hasVoice = !!msg.voice || !!msg.audio
  const hasText = !!rawText && rawText.trim().length > 0
  if (hasVoice || hasText) {
    await processMacroInput(bot, chat, from, rawText, msg)
    return true
  }

  if (firstGoal) {
    await bot.sendMessage(chatId, 'Got it — now let’s set your direction for the week.')
  }

  const intro =
    'What’s something that really matters to you right now — maybe around your health, focus, or wellbeing?\nYou can type it in or send a voice message.\n\nHere are a few ideas if you need inspiration:'

  // Fetch suggestions
  const suggestions: GoalSuggestedModel[] =
    await GoalsService.goalsControllerGenerateMacroGoalSuggestions()

  // Send prompt with inline keyboard of suggestions
  const sent = await bot.sendMessage(chatId, intro, {
    reply_markup: buildMacroSuggestionKeyboard(suggestions.slice(0, 3)),
  })
  macroSuggestionStore.set(keyFor(chatId, sent.message_id), suggestions)

  // No immediate input to process; wait for user reply or suggestion tap
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
  // Inform user we're processing
  const processingMsg = await bot.sendMessage(chatId, 'Processing...')

  try {
    // Always clear existing check-ins prior to creating a new macro context
    await CheckInsService.checkInsControllerClearCheckIns()

    let created: GoalModel | null = null

    // Priority: if a suggestion text was provided via callback
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
      created = await GoalsService.goalsControllerCreateMacroGoalFromText({
        requestBody: { text: rawText.trim() },
      })
    }

    // Schedule morning and evening check-ins with correct metadata including chatId
    await scheduleCheckIns(chatId)

    // Acknowledge success to the user and explain flow
    await bot.sendMessage(
      chatId,
      'Every morning you will get a set of 3 new micro goals.\n\nIn the evening, I will check in to see how things went.',
    )

    // Immediately generate the first set of micro goals
    await actionMicroGoalsGenerate(bot, chat, from, '', msg)
  } catch (e) {
    console.error('ActionMacroGoal error: ', e)
    await bot.sendMessage(chatId, 'Sorry, I could not create your macro goal. Please try again.')
  } finally {
    // Attempt to remove the 'Processing...' message
    try {
      await bot.deleteMessage(chatId, processingMsg.message_id)
    } catch {}
  }
}

// Expose helpers for callback handlers
export function getMacroSuggestionsForMessage(chatId: number, messageId: number) {
  return macroSuggestionStore.get(keyFor(chatId, messageId)) || []
}
export function clearMacroSuggestionsForMessage(chatId: number, messageId: number) {
  macroSuggestionStore.delete(keyFor(chatId, messageId))
}
