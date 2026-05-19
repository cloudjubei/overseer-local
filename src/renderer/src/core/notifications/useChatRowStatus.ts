import { useEffect, useMemo, useState } from 'react'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContextKey } from '../chats/chatKey'
import { useChats } from '../contexts/ChatsContext'
import { CHATS_SEEN_EVENT, isChatUnread, readChatsSeen, type ChatsSeenMap } from './chatsSeen'

export type ChatRowStatus = {
  /** True when an LLM request is in flight for this chat. */
  isThinking: boolean
  /** True when the chat has messages newer than the stored last-seen ts. */
  isUnread: boolean
  /** Approximate count of unread messages — used in the row badge. */
  unreadCount: number
  /** True for agent-run chats currently running. */
  isAgentRunning: boolean
}

/**
 * Surfaces the live state web's sidebar rows need:
 *  - in-flight thinking spinner (`ChatsContext` live state)
 *  - unread chip (per `chatsSeen` localStorage map)
 *  - agent-run badge (chat.state === 'running' | 'created')
 *
 * Mirrors the desktop sidebar's `useChatThinking` + `useChatUnread` combo,
 * but reads from web's existing primitives instead of adding new providers.
 */
export function useChatRowStatus(context: ChatContext): ChatRowStatus {
  const { getChat, getChatLiveState } = useChats()
  const chat = getChat(context)
  const live = getChatLiveState(context)
  const isAgentContext = context.type === 'AGENT_RUN_STORY' || context.type === 'AGENT_RUN_FEATURE'
  const isAgentRunning = Boolean(
    isAgentContext && (chat?.state === 'running' || chat?.state === 'created'),
  )

  const [seen, setSeen] = useState<ChatsSeenMap>(readChatsSeen)
  useEffect(() => {
    const reread = () => setSeen(readChatsSeen())
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'thefactory.chatsSeen') reread()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHATS_SEEN_EVENT, reread)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHATS_SEEN_EVENT, reread)
    }
  }, [])

  return useMemo<ChatRowStatus>(() => {
    const key = getChatContextKey(context)
    const messages = chat?.messages ?? []
    const latest = messages.length
      ? (messages[messages.length - 1].completedAt ?? messages[messages.length - 1].startedAt)
      : undefined
    const isUnread = isChatUnread(seen, key, latest)
    let unreadCount = 0
    if (isUnread) {
      const since = seen[key]
      if (since) {
        for (const m of messages) {
          const ts = m.completedAt ?? m.startedAt
          if (ts && ts > since) unreadCount += 1
        }
      } else {
        unreadCount = messages.length
      }
    }
    return {
      isThinking: live.isSending,
      isUnread,
      unreadCount,
      isAgentRunning,
    }
  }, [chat, context, isAgentRunning, live.isSending, seen])
}
