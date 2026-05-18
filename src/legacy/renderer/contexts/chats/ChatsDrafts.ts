import { useCallback, useRef } from 'react'
import type { ChatDraft } from './ChatsTypes'

export function useChatDrafts() {
  // Per-chat in-memory draft message + pending attachments.
  const draftsRef = useRef<Record<string, ChatDraft>>({})
  const defaultDraftsRef = useRef<Record<string, ChatDraft>>({})

  // getDraft is intentionally ref-based (stable identity, no re-render cascade).
  // Consumers should read it at the point they need the value (e.g. on chat switch),
  // NOT as a reactive dependency.
  const getDraft = useCallback((chatKey: string): ChatDraft => {
    const existing = draftsRef.current[chatKey]
    if (existing) return existing

    const cached = defaultDraftsRef.current[chatKey]
    if (cached) return cached

    const def: ChatDraft = { text: '', attachments: [] }
    defaultDraftsRef.current[chatKey] = def
    return def
  }, [])

  const setDraft = useCallback((chatKey: string, patch: Partial<ChatDraft>) => {
    const cur = draftsRef.current[chatKey] || { text: '', attachments: [] }
    draftsRef.current[chatKey] = { ...cur, ...patch }
  }, [])

  const clearDraft = useCallback((chatKey: string) => {
    delete draftsRef.current[chatKey]
  }, [])

  return { getDraft, setDraft, clearDraft }
}
