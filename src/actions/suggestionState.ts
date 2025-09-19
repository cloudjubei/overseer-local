// Simple in-memory registry to map Telegram messages to suggestion payloads
// Key: `${chatId}:${messageId}` -> SuggestedGoalDto[]

import type { SuggestedGoalDto } from '../generated/backend/models/SuggestedGoalDto'

const registry = new Map<string, SuggestedGoalDto[]>()

function key(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`
}

export function saveSuggestionsForMessage(
  chatId: number,
  messageId: number,
  suggestions: SuggestedGoalDto[] | undefined | null,
): void {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return
  registry.set(key(chatId, messageId), suggestions)
}

export function getSuggestionsForMessage(
  chatId: number,
  messageId: number,
): SuggestedGoalDto[] | undefined {
  return registry.get(key(chatId, messageId))
}

export function clearSuggestionsForMessage(chatId: number, messageId: number): void {
  registry.delete(key(chatId, messageId))
}
