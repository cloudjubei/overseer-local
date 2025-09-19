import type TelegramBot from 'node-telegram-bot-api'
import type { ConversationPromptDto } from '../generated/backend/models/ConversationPromptDto'
import type { PromptOptionDto } from '../generated/backend/models/PromptOptionDto'
import type { PromptFieldDto } from '../generated/backend/models/PromptFieldDto'

function formatFields(fields: Array<PromptFieldDto> | undefined): string[] {
  if (!Array.isArray(fields) || fields.length === 0) return []
  const lines: string[] = []
  lines.push('Please provide:')
  for (const f of fields) {
    const required = f.required ? ' (required)' : ''
    const type = f.type === 'password' ? 'password' : 'text'
    lines.push(`- ${f.label}${required} [${type}]`)
  }
  return lines
}

function buildOptionsKeyboard(
  options: Array<PromptOptionDto> | undefined,
  selectionName?: string,
): TelegramBot.InlineKeyboardMarkup | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined

  const rows: TelegramBot.InlineKeyboardButton[][] = []
  const selKey = (selectionName && selectionName.trim()) || 'selection'

  for (const opt of options) {
    const label = String(opt.label || '').trim() || String(opt.value || '')
    // Namespace callback_data per CODE_STANDARD (e.g., goals:...)
    // Include selection name and raw value so a future handler can submit it back to backend.
    const cb = `convo:select:${selKey}:${String(opt.value || '')}`
    rows.push([{ text: label, callback_data: cb }])
  }

  return { inline_keyboard: rows }
}

export function formatPromptMessage(prompt: ConversationPromptDto): string {
  const lines: string[] = []
  const hasTitle = !!(prompt.title && prompt.title.trim().length > 0)
  const hasMessage = !!(prompt.message && prompt.message.trim().length > 0)

  if (hasTitle) {
    lines.push(prompt.title!.trim())
  }

  if (hasMessage) {
    if (lines.length) lines.push('')
    lines.push(prompt.message!.trim())
  }

  const fieldLines = formatFields(prompt.fields)
  if (fieldLines.length) {
    if (lines.length) lines.push('')
    lines.push(...fieldLines)
  }

  return lines.join('\n')
}

export async function renderBackendPrompt(
  prompt: ConversationPromptDto,
  bot: TelegramBot,
  chatId: number,
): Promise<TelegramBot.Message> {
  const text = formatPromptMessage(prompt)
  const replyMarkup = buildOptionsKeyboard(prompt.options, prompt.selectionName)
  return bot.sendMessage(chatId, text, replyMarkup ? { reply_markup: replyMarkup } : undefined)
}
