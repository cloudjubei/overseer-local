import { useMemo } from 'react'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { computeChatRowStatus, type ChatRowStatus } from 'thefactory-ui/headless'
import { useChatsSeen } from 'thefactory-ui/web'
import { getChatContextKey } from '../chats/chatKey'
import { useChats } from 'thefactory-ui/headless'

export type { ChatRowStatus }

/**
 * Surfaces the live state the sidebar rows need:
 *  - in-flight thinking spinner (`ChatsContext` live state)
 *  - unread chip (per `chatsSeen` localStorage map)
 *  - agent-run badge (chat.state === 'running' | 'created')
 *
 * Thin wrapper around the shared headless `computeChatRowStatus` — the
 * mobile peer follows the same pattern.
 */
export function useChatRowStatus(context: ChatContext): ChatRowStatus {
  const { getChat, getChatLiveState } = useChats()
  const chat = getChat(context)
  const live = getChatLiveState(context)
  const seen = useChatsSeen()
  const contextKey = getChatContextKey(context)
  return useMemo(
    () =>
      computeChatRowStatus({
        context,
        contextKey,
        chat,
        isSending: live.isSending,
        seen,
      }),
    [context, contextKey, chat, live.isSending, seen],
  )
}
