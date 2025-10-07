// Simple in-memory registry to map Telegram messages to suggestion payloads
// Key: `${chatId}:${messageId}` -> { suggestions, genericSuggestions }

import { GoalSuggestedModel } from 'src/generated/backend'

type SuggestionBundle = {
  suggestions: GoalSuggestedModel[]
  genericSuggestions: GoalSuggestedModel[]
}

const registry = new Map<string, SuggestionBundle>()

function key(chatId: number, messageId: number): string {
  return `${chatId}:${messageId}`
}

export function saveSuggestionsForMessage(
  chatId: number,
  messageId: number,
  suggestions: GoalSuggestedModel[] | undefined | null,
  genericSuggestions?: GoalSuggestedModel[] | undefined | null,
): void {
  const primary = Array.isArray(suggestions) ? suggestions : []
  const generic = Array.isArray(genericSuggestions) ? genericSuggestions : []
  if (primary.length === 0 && generic.length === 0) return
  registry.set(key(chatId, messageId), { suggestions: primary, genericSuggestions: generic })
}

export function getSuggestionsForMessage(
  chatId: number,
  messageId: number,
): GoalSuggestedModel[] | undefined {
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
