// Simple in-memory registry to map Telegram messages to suggestion payloads
// Key: `${chatId}:${messageId}` -> { suggestions, genericSuggestions }

import type { SuggestedGoalDto } from '../generated/backend/models/SuggestedGoalDto'

type SuggestionBundle = {
  suggestions: SuggestedGoalDto[]
  genericSuggestions: SuggestedGoalDto[]
}

const registry = new Map<string, SuggestionBundle>()

function key(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`
}

export function saveSuggestionsForMessage(
  chatId: number,
  messageId: number,
  suggestions: SuggestedGoalDto[] | undefined | null,
  genericSuggestions?: SuggestedGoalDto[] | undefined | null,
): void {
  const primary = Array.isArray(suggestions) ? suggestions : []
  const generic = Array.isArray(genericSuggestions) ? genericSuggestions : []
  if (primary.length === 0 && generic.length === 0) return
  registry.set(key(chatId, messageId), { suggestions: primary, genericSuggestions: generic })
}

export function getSuggestionsForMessage(
  chatId: number,
  messageId: number,
): SuggestedGoalDto[] | undefined {
  return registry.get(key(chatId, messageId))?.suggestions
}

export function getSuggestionBundleForMessage(
  chatId: number,
  messageId: number,
): SuggestionBundle | undefined {
  return registry.get(key(chatId, messageId))
}

export function clearSuggestionsForMessage(chatId: number, messageId: number): void {
  registry.delete(key(chatId, messageId))
}
