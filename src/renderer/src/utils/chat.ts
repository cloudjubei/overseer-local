import type { ChatMessage } from 'thefactory-tools'

// Best-effort extraction of an ISO timestamp for a single message
export function messageIso(message: ChatMessage): string | undefined {
  const cm = (message as any)?.completionMessage
  if (cm?.completedAt) return cm.completedAt as string
  if (cm?.startedAt) return cm.startedAt as string
  const createdAt = (message as any)?.createdAt
  if (typeof createdAt === 'string') return createdAt
  return undefined
}

export function lastMessageIso(messages: ChatMessage[]): string | undefined {
  if (!messages || messages.length === 0) return undefined
  const last = messages[messages.length - 1]
  return messageIso(last)
}
