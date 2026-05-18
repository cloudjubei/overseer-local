import type { CompletionMessage } from 'thefactory-tools'

// Best-effort extraction of an ISO timestamp for a single message
export function messageIso(message: CompletionMessage): string | undefined {
  return message.completedAt
}

export function lastMessageIso(messages: CompletionMessage[]): string | undefined {
  if (!messages || messages.length === 0) return undefined
  const last = messages[messages.length - 1]
  return messageIso(last)
}
