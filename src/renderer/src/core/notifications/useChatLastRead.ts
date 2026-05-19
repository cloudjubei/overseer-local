import { useMemo } from 'react'
import {
  useChatLastRead as useChatLastReadHeadless,
  type ChatLastReadStore,
  type UseChatLastReadApi as HeadlessApi,
} from 'thefactory-ui/headless'
import { getChatContextKey } from '../chats/chatKey'
import type { ChatContext } from 'thefactory-ui/headless/api'

const LS_PREFIX = 'chat:last-read:'
const EVT_KEY = 'chat-last-read-changed'

function lsKey(chatKey: string) {
  return `${LS_PREFIX}${chatKey}`
}

const STORE: ChatLastReadStore = {
  getLastRead: (chatKey: string) => {
    try {
      return window.localStorage.getItem(lsKey(chatKey)) || undefined
    } catch {
      return undefined
    }
  },
  setLastRead: (chatKey: string, iso: string) => {
    try {
      window.localStorage.setItem(lsKey(chatKey), iso)
      // `storage` event doesn't fire in the originating document, so we
      // dispatch a same-document custom event for other hook instances.
      window.dispatchEvent(new CustomEvent(EVT_KEY, { detail: { chatKey, iso } }))
    } catch {
      /* localStorage unavailable */
    }
  },
  subscribe: (cb) => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key && ev.key.startsWith(LS_PREFIX)) cb()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVT_KEY, cb as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVT_KEY, cb as EventListener)
    }
  },
}

export type UseChatLastReadApi = {
  lastReadIso: string | undefined
  markReadByKey: HeadlessApi['markReadByKey']
  markReadByContext: (ctx: ChatContext, iso?: string) => void
  getLastReadForKey: HeadlessApi['getLastReadForKey']
}

/**
 * Per-chat "last read" timestamp. Persisted to localStorage with cross-tab
 * + same-document sync. The pure state-machine and re-render logic come
 * from `thefactory-ui/headless`; this wrapper plugs in the web-specific
 * `localStorage` + `CustomEvent` wiring.
 */
export function useChatLastRead(context: ChatContext | undefined): UseChatLastReadApi {
  const chatKey = useMemo(() => (context ? getChatContextKey(context) : undefined), [context])
  const api = useChatLastReadHeadless({
    chatKey,
    store: STORE,
    contextKey: (ctx) => getChatContextKey(ctx as ChatContext),
  })

  return {
    lastReadIso: api.lastReadIso,
    markReadByKey: api.markReadByKey,
    markReadByContext: (ctx, iso) => api.markReadByContext(ctx, iso),
    getLastReadForKey: api.getLastReadForKey,
  }
}
