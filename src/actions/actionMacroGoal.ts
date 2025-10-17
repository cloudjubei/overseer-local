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
import { buildSuggestionKeyboard } from 'src/common/keyboards'
import { buildSuggestionMessageText } from './suggestionRenderer'

// In-memory store to map suggestion lists per message for callback selections
// Keyed by `${chatId}:${messageId}` -> suggestions array
const macroSuggestionStore = new Map<string, GoalSuggestedModel[]>()

// In-memory store to map latest suggestion list per chat for non-inline keyboard selections
const macroChatSuggestions = new Map<number, GoalSuggestedModel[]>()

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

// Utility: count the number of hidden prefix characters used in our reply keyboards
function countHiddenPrefix(text: string): number {
  const HIDDEN = '‎' // U+200E LEFT-TO-RIGHT MARK
  let i = 0
  while (i < text.length && text[i] === HIDDEN) i++
  return i
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

  // If the current message already carries input (audio) -> process immediately
  const hasVoice = !!msg.voice || !!msg.audio
  const hasText = !!rawText && rawText.trim().length > 0

  // Handle selection from our non-inline suggestion keyboard
  if (hasText) {
    const hiddenCount = countHiddenPrefix(rawText)
    if (hiddenCount > 0) {
      const idx = hiddenCount - 1
      const suggestions = macroChatSuggestions.get(chatId) || []
      if (suggestions.length > 0) {
        // Refine option is appended after N suggestions, so handle that explicitly
        if (idx === suggestions.length) {
          await bot.sendMessage(
            chatId,
            'Tell me a bit more about what you want to focus on. You can type or send a voice message.',
          )
          return true
        }

        const picked = suggestions[idx]
        if (picked) {
          await processMacroInput(bot, chat, from, '', msg, picked.summary)
          return true
        }
      }
      // If we had a hidden prefix but no stored suggestions, ignore and fall through to normal text handling
    }
  }

  // If user sent free text or voice, treat as custom macro (skip suggestions)
  if (hasVoice || (hasText && countHiddenPrefix(rawText) === 0)) {
    await processMacroInput(bot, chat, from, rawText, msg)
    return true
  }

  if (firstGoal) {
    await bot.sendMessage(chatId, 'Now let’s set your direction for the week.')
    // add sleep of 2s
    await sleep(2000)
  }

  const introHeader =
    'What’s something that really matters to you right now — maybe around your health, focus, or wellbeing?\nYou can type it in or send a voice message.\n\nHere are a few ideas if you need inspiration:'

  // Fetch suggestions
  const allSuggestions: GoalSuggestedModel[] =
    await GoalsService.goalsControllerGenerateMacroGoalSuggestions()
  const suggestions = (allSuggestions || []).slice(0, 3)

  // Render message body listing options fully to avoid clipping, then show non-inline keyboard
  const text = buildSuggestionMessageText({ headerMessage: introHeader, suggestions })
  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: buildSuggestionKeyboard(suggestions, false),
  })

  // Save for subsequent selection mapping
  macroChatSuggestions.set(chatId, suggestions)

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
