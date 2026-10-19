import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ASSISTANT_COPY,
  isGlobalChat,
  newGlobalChatContext,
  useAssistantConversations,
  useChats,
} from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { AssistantConversationList, LoadingScreen, useChatsSeen } from 'thefactory-ui/web'
import { assistantPath } from '@core/chats/assistantPath'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'
import ChatHeaderConnected from '@ui/components/chat/ChatHeaderConnected'

function readConversation(contextKey: string | undefined): ChatContext | undefined {
  if (!contextKey) return undefined
  try {
    const context = getChatContext(contextKey) ?? undefined
    return context && isGlobalChat({ context }) ? context : undefined
  } catch {
    return undefined
  }
}

/**
 * The Assistant page: its conversations beside the open one. `/assistant/:contextKey`
 * opens a conversation; a bare `/assistant` opens the newest. + starts a new
 * conversation without touching the others; archiving, moving back and
 * deleting live in the open conversation's settings menu. Desktop peer of
 * overseer-web's big-screen `AssistantView`.
 */
export default function AssistantView(): React.JSX.Element {
  const { contextKey } = useParams<{ contextKey?: string }>()
  const navigate = useNavigate()
  const { isLoaded, loadError } = useChats()
  const seen = useChatsSeen()
  const open = useMemo(() => readConversation(contextKey), [contextKey])
  const { conversations, archived } = useAssistantConversations(seen, open)

  const openConversation = useCallback(
    (context: ChatContext) => navigate(assistantPath(context)),
    [navigate],
  )
  const startConversation = useCallback(
    () => navigate(assistantPath(newGlobalChatContext())),
    [navigate],
  )

  useEffect(() => {
    if (open || !isLoaded) return
    navigate(assistantPath(conversations[0]?.context ?? newGlobalChatContext()), {
      replace: true,
    })
  }, [open, isLoaded, conversations, navigate])

  if (!isLoaded) return <LoadingScreen label="Loading conversations…" />
  if (loadError) {
    return <LoadingScreen label="Could not load conversations" error={loadError.message} />
  }

  return (
    <div className="flex h-full w-full flex-row overflow-hidden">
      <aside
        className="flex w-72 shrink-0 flex-col overflow-hidden border-r"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)' }}
      >
        <AssistantConversationList
          conversations={conversations}
          archived={archived}
          {...(open ? { activeKey: getChatContextKey(open) } : {})}
          onOpen={openConversation}
          onNew={startConversation}
        />
      </aside>
      {open ? (
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <ChatBodyForContext
            context={open}
            header={
              <ChatHeaderConnected
                context={open}
                onDeleted={() => navigate(assistantPath(), { replace: true })}
              />
            }
            inputProps={{ autoFocus: true, placeholder: ASSISTANT_COPY.placeholder }}
          />
        </div>
      ) : null}
    </div>
  )
}
