import type TelegramBot from 'node-telegram-bot-api'
import { saveSuggestionsForMessage } from './suggestionState'
import {
  buildSuggestionKeyboard,
  buildSuggestionKeyboardInline,
  difficultyStars,
} from 'src/common/keyboards'
import { GoalSuggestedModel } from 'src/generated/backend'

// Utilities
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function difficultyToLabel(d: GoalSuggestedModel.difficulty | string | undefined): string {
  switch (String(d || '').toUpperCase()) {
    case 'EASY':
      return 'Easy'
    case 'MEDIUM':
      return 'Medium'
    case 'HARD':
      return 'Ambitious'
    default:
      return 'Other'
  }
}

export function buildSuggestionMessageText(params: {
  headerMessage?: string
  suggestions: GoalSuggestedModel[]
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
export function buildAiSuggestionRender(payload: AiSuggestionsResultModel): {
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
  const reply_markup = buildSuggestionKeyboardInline(suggestions, showExtraSuggestions)
  return { text, options: { parse_mode: 'HTML', reply_markup } }
}

export function buildParamSuggestionRender(
  suggestions: GoalSuggestedModel[],
  header?: string,
): { text: string; options: TelegramBot.SendMessageOptions } {
  const text = buildSuggestionMessageText({
    headerMessage: header || 'Great! Here are some options:',
    suggestions,
  })
  // For param suggestions (/q), we do not show the extra generic selector button
  const reply_markup = buildSuggestionKeyboardInline(suggestions, false)
  return { text, options: { parse_mode: 'HTML', reply_markup } }
}

export async function renderAiSuggestionResult(
  bot: TelegramBot,
  chatId: number,
  payload: AiSuggestionsResultModel,
): Promise<TelegramBot.Message> {
  const { text, options } = buildAiSuggestionRender(payload)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store both primary and generic suggestions for callback handling
  const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : []
  const generic = Array.isArray(payload?.genericSuggestions) ? payload.genericSuggestions : []
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions, generic)
  return sent
}

export async function renderAiSuggestionResultKeyboard(
  bot: TelegramBot,
  chatId: number,
  payload: AiSuggestionsResultModel,
): Promise<TelegramBot.Message> {
  const { text, options } = buildAiSuggestionRenderKeyboard(payload)
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
  suggestions: GoalSuggestedModel[],
  header?: string,
): Promise<TelegramBot.Message> {
  const { text, options } = buildParamSuggestionRender(suggestions, header)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store only the primary suggestions for param-based flows
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions)
  return sent
}

export async function renderParamSuggestionsKeyboard(
  bot: TelegramBot,
  chatId: number,
  suggestions: GoalSuggestedModel[],
  header?: string,
): Promise<TelegramBot.Message> {
  const { text, options } = buildParamSuggestionRenderKeyboard(suggestions, header)
  const sent = await bot.sendMessage(chatId, text, options)
  // Store only the primary suggestions for param-based flows
  saveSuggestionsForMessage(chatId, sent.message_id, suggestions)
  return sent
}
export function buildParamSuggestionRenderKeyboard(
  suggestions: GoalSuggestedModel[],
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

// High-level helpers for actions to use
export function buildAiSuggestionRenderKeyboard(payload: AiSuggestionsResultModel): {
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
