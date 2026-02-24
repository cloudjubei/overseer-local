import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChats } from '@renderer/contexts/ChatsContext'

type SelectionPatch = { selectionStart?: number; selectionEnd?: number }

type DraftState = {
  text: string
  attachments: string[]
  selectionStart?: number
  selectionEnd?: number
}

export type UseChatDraftReturn = {
  text: string
  setText: (text: string) => void

  attachments: string[]
  setAttachments: (attachments: string[]) => void

  selectionStart?: number
  selectionEnd?: number
  setSelection: (sel: SelectionPatch) => void

  flushPersist: () => void
  clear: () => void

  focusNonce: number
}

/**
 * Keeps chat input draft (text, attachments, cursor selection) persisted per chat key.
 *
 * - Restores draft when chatKey changes.
 * - Debounced persistence of text and selection.
 * - Immediate persistence of attachments.
 */
export function useChatDraft(chatKey: string): UseChatDraftReturn {
  const { getDraft, setDraft, clearDraft } = useChats()

  const prevChatKeyRef = useRef<string | undefined>(undefined)
  const draftPersistTimerRef = useRef<number | null>(null)
  const selectionPersistTimerRef = useRef<number | null>(null)

  const initial = useMemo(() => getDraft(chatKey) as DraftState, [getDraft, chatKey])

  const [text, _setText] = useState<string>(initial.text)
  const [attachments, _setAttachments] = useState<string[]>(initial.attachments)

  const selectionStartRef = useRef<number | undefined>(initial.selectionStart)
  const selectionEndRef = useRef<number | undefined>(initial.selectionEnd)

  const [focusNonce, setFocusNonce] = useState(0)

  useEffect(() => {
    // On chat change, restore draft + bump focus nonce
    if (prevChatKeyRef.current === chatKey) return
    prevChatKeyRef.current = chatKey

    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = null
    }
    if (selectionPersistTimerRef.current) {
      window.clearTimeout(selectionPersistTimerRef.current)
      selectionPersistTimerRef.current = null
    }

    const d = getDraft(chatKey) as DraftState
    _setText(d.text)
    _setAttachments(d.attachments)
    selectionStartRef.current = d.selectionStart
    selectionEndRef.current = d.selectionEnd

    setFocusNonce((x) => x + 1)
  }, [chatKey, getDraft])

  useEffect(() => {
    return () => {
      if (draftPersistTimerRef.current) window.clearTimeout(draftPersistTimerRef.current)
      if (selectionPersistTimerRef.current) window.clearTimeout(selectionPersistTimerRef.current)
    }
  }, [])

  const schedulePersistText = useCallback(
    (nextText: string) => {
      if (draftPersistTimerRef.current) window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = window.setTimeout(() => {
        draftPersistTimerRef.current = null
        setDraft(chatKey, { text: nextText })
      }, 150)
    },
    [chatKey, setDraft],
  )

  const schedulePersistSelection = useCallback(
    (sel: SelectionPatch) => {
      if (selectionPersistTimerRef.current) window.clearTimeout(selectionPersistTimerRef.current)
      selectionPersistTimerRef.current = window.setTimeout(() => {
        selectionPersistTimerRef.current = null
        setDraft(chatKey, sel)
      }, 250)
    },
    [chatKey, setDraft],
  )

  const setText = useCallback(
    (next: string) => {
      _setText(next)
      schedulePersistText(next)
    },
    [schedulePersistText],
  )

  const setAttachments = useCallback(
    (next: string[]) => {
      _setAttachments(next)
      setDraft(chatKey, { attachments: next })
    },
    [chatKey, setDraft],
  )

  const setSelection = useCallback(
    (sel: SelectionPatch) => {
      selectionStartRef.current = sel.selectionStart
      selectionEndRef.current = sel.selectionEnd
      schedulePersistSelection(sel)
    },
    [schedulePersistSelection],
  )

  const flushPersist = useCallback(() => {
    if (draftPersistTimerRef.current) {
      window.clearTimeout(draftPersistTimerRef.current)
      draftPersistTimerRef.current = null
    }
    setDraft(chatKey, { text, attachments })
  }, [chatKey, setDraft, text, attachments])

  const clear = useCallback(() => {
    clearDraft(chatKey)
    _setText('')
    _setAttachments([])
    selectionStartRef.current = undefined
    selectionEndRef.current = undefined
  }, [chatKey, clearDraft])

  return {
    text,
    setText,
    attachments,
    setAttachments,
    selectionStart: selectionStartRef.current,
    selectionEnd: selectionEndRef.current,
    setSelection,
    flushPersist,
    clear,
    focusNonce,
  }
}
