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

function difficultyStars(d?: SuggestedGoalDto.difficulty | string): string {
  const diff = String(d || '').toUpperCase()
  const count = diff === 'MEDIUM' ? 2 : diff === 'HARD' ? 3 : 1
  return '★'.repeat(count)
}

// Core builders
export function buildSuggestionKeyboard(
  suggestions: SuggestedGoalDto[],
  showExtraSuggestions: boolean = false,
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = []

  const isSameDifficulty = suggestions.every((s) => s.difficulty === suggestions[0].difficulty)

  suggestions.forEach((sug, idx) => {
    const label = isSameDifficulty ? sug.summary : difficultyStars(sug.difficulty)
    const n = idx + 1
    const text = `${n} • ${label}`
    rows.push([
      {
        text,
        callback_data: `suggest:choose:${idx}`,
      },
    ])
  })

  if (showExtraSuggestions) {
    rows.push([
      {
        text: '✏️ Refine',
        callback_data: 'suggest:refine',
      },
      {
        text: '📋 Select',
        callback_data: 'suggest:select',
      },
    ])
  } else {
    rows.push([
      {
        text: '✏️ Refine',
        callback_data: 'suggest:refine',
      },
    ])
  }

  return { inline_keyboard: rows }
}

export function buildSuggestionMessageText(params: {
  headerMessage?: string
  suggestions: SuggestedGoalDto[]
}): string {
  const { headerMessage, suggestions } = params
  const lines: string[] = []

  // Header similar to the mock
  if (headerMessage && headerMessage.trim()) {
    lines.push(`<b>${escapeHtml(headerMessage.trim())}</b>`) // bold title
  } else {
    lines.push('<b>Great! Here are some options:</b>')
  }

  // Render full option texts (numbered) so they never get clipped
  suggestions.forEach((sug, idx) => {
    const n = idx + 1
    const stars = difficultyStars(sug.difficulty)
    const label = difficultyToLabel(sug.difficulty)
    const meta = [stars, label && !stars ? label : ''].filter(Boolean).join(' ')
    const line = meta ? `${n}) ${meta} — ${escapeHtml(sug.text)}` : `${n}) ${escapeHtml(sug.text)}`
    lines.push(line)
  })
  return lines.join('\n')
}

// High-level helpers for actions to use
export function buildAiSuggestionRender(payload: AiSuggestionsResultDto): {
  text: string
  options: TelegramBot.SendMessageOptions
} {
  // If AI returned no targeted suggestions, fall back to generic ones
  const hasPrimary = Array.isArray(payload?.suggestions) && payload.suggestions.length > 0
  const suggestions = hasPrimary ? payload.suggestions : payload.genericSuggestions

  const text = buildSuggestionMessageText({
    headerMessage: payload.needsConfirmation
      ? payload?.message || 'Great! Here are some options:'
      : 'Great! Here are some options:',
    suggestions,
  })

  // Show extra generic button only if we have primary suggestions and also have generic suggestions to offer
  const showExtraSuggestions =
    hasPrimary &&
    Array.isArray(payload?.genericSuggestions) &&
    payload.genericSuggestions.length > 0
  const reply_markup = buildSuggestionKeyboard(suggestions, showExtraSuggestions)
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
  // For param suggestions (/q), we do not show the extra generic selector button
  const reply_markup = buildSuggestionKeyboard(suggestions, false)
  return { text, options: { parse_mode: 'HTML', reply_markup } }
}

export async function renderAiSuggestionResult(
  bot: TelegramBot,
  chatId: number,
  payload: AiSuggestionsResultDto,
): Promise<TelegramBot.Message> {
  const { text, options } = buildAiSuggestionRender(payload)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store both primary and generic suggestions for callback handling
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : []
  const generic = Array.isArray(payload?.genericSuggestions) ? payload.genericSuggestions : []
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions, generic)
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
  // Store only the primary suggestions for param-based flows
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions)
  return sent
}
