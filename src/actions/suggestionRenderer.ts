import type TelegramBot from 'node-telegram-bot-api'
import type { AiSuggestionsResultDto } from '../generated/backend/models/AiSuggestionsResultDto'
import type { SuggestedGoalDto } from '../generated/backend/models/SuggestedGoalDto'
import { saveSuggestionsForMessage } from './suggestionState'

// Utilities
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function difficultyToLabel(d: SuggestedGoalDto.difficulty | string | undefined): string {
  switch (String(d || '').toUpperCase()) {
    case 'EASY':
      return 'Easy'
    case 'MEDIUM':
      return 'Medium'
    case 'HARD':
      // Mock uses "Ambitious" for HARD
      return 'Ambitious'
    default:
      return 'Other'
  }
}

function difficultyStars(d: SuggestedGoalDto.difficulty | string | undefined): string {
  const diff = String(d || '').toUpperCase()
  const count = diff === 'EASY' ? 1 : diff === 'MEDIUM' ? 2 : diff === 'HARD' ? 3 : 0
  return count > 0 ? '★'.repeat(count) : ''
}

function formatConfidence(n?: number): string | undefined {
  if (typeof n !== 'number' || isNaN(n)) return undefined
  // If in 0..1, render as percentage, else clamp 0..100
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(Math.max(0, Math.min(100, n)))
  return `${pct}%`
}

// Core builders
export function buildSuggestionKeyboard(
  suggestions: SuggestedGoalDto[],
): TelegramBot.InlineKeyboardMarkup {
  const top = (suggestions || []).slice(0, 3)
  const rows: TelegramBot.InlineKeyboardButton[][] = []

  top.forEach((sug, idx) => {
    const stars = difficultyStars(sug.difficulty)
    const label = difficultyToLabel(sug.difficulty)
    const text = [stars, label ? ` ${label} —` : '', ` ${sug.text}`]
      .join('')
      .trim()
      .slice(0, 64) // keep within Telegram button display width sensibly
    rows.push([
      {
        text,
        callback_data: `suggest:choose:${idx}`,
      },
    ])
  })

  // Additional actions inspired by mock: Refine / Select
  rows.push([
    {
      text: '✏️ Refine',
      callback_data: 'suggest:refine',
    },
  ])
  rows.push([
    {
      text: '📋 Select',
      callback_data: 'suggest:select',
    },
  ])

  return { inline_keyboard: rows }
}

export function buildSuggestionMessageText(params: {
  headerMessage?: string
  understoodText?: string
  combinedConfidence?: number
  llmConfidence?: number
  transcriptionConfidence?: number
  suggestions: SuggestedGoalDto[]
}): string {
  const { headerMessage, understoodText, combinedConfidence, llmConfidence, transcriptionConfidence } = params
  const lines: string[] = []

  // Header similar to the mock
  if (headerMessage && headerMessage.trim()) {
    lines.push(`<b>${escapeHtml(headerMessage.trim())}</b>`) // bold title
  } else {
    lines.push('<b>Great! Here are some options:</b>')
  }

  // Subtext (optional understanding + confidences)
  const confBits: string[] = []
  const combined = formatConfidence(combinedConfidence)
  const llm = formatConfidence(llmConfidence)
  const tr = formatConfidence(transcriptionConfidence)
  if (combined) confBits.push(`confidence ${combined}`)
  if (llm) confBits.push(`LLM ${llm}`)
  if (tr) confBits.push(`ASR ${tr}`)

  const subparts: string[] = []
  if (understoodText && understoodText.trim()) {
    subparts.push(`understood: “${escapeHtml(understoodText.trim())}”`)
  }
  if (confBits.length) subparts.push(confBits.join(', '))
  if (subparts.length) lines.push(`<i>${subparts.join(' • ')}</i>`) // italic hint

  // Visual separator similar to the mock before secondary actions
  lines.push('\n<i>— Not the goals you looked for? —</i>')

  return lines.join('\n')
}

// High-level helpers for actions to use
export function buildAiSuggestionRender(
  payload: AiSuggestionsResultDto,
): { text: string; options: TelegramBot.SendMessageOptions } {
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : []
  const text = buildSuggestionMessageText({
    headerMessage: payload?.message || 'Great! Here are some options:',
    understoodText: payload?.understoodText,
    combinedConfidence: payload?.combinedConfidence,
    llmConfidence: payload?.llmConfidence,
    transcriptionConfidence: payload?.transcriptionConfidence,
    suggestions,
  })
  const reply_markup = buildSuggestionKeyboard(suggestions)
  return { text, options: { parse_mode: 'HTML', reply_markup } }
}

export function buildParamSuggestionRender(
  suggestions: SuggestedGoalDto[],
  header?: string,
): { text: string; options: TelegramBot.SendMessageOptions } {
  const text = buildSuggestionMessageText({
    headerMessage: header || 'Great! Here are some options:',
    suggestions,
  })
  const reply_markup = buildSuggestionKeyboard(suggestions)
  return { text, options: { parse_mode: 'HTML', reply_markup } }
}

export async function renderAiSuggestionResult(
  bot: TelegramBot,
  chatId: number,
  payload: AiSuggestionsResultDto,
): Promise<TelegramBot.Message> {
  const { text, options } = buildAiSuggestionRender(payload)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store suggestions for callback handling
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : []
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions)
  return sent
}

export async function renderParamSuggestions(
  bot: TelegramBot,
  chatId: number,
  suggestions: SuggestedGoalDto[],
  header?: string,
): Promise<TelegramBot.Message> {
  const { text, options } = buildParamSuggestionRender(suggestions, header)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store suggestions for callback handling
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions)
  return sent
}
