import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { isAgentRunChatContext } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import { ChatList } from 'thefactory-ui/web'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'
import ChatHeaderConnected from '@ui/components/chat/ChatHeaderConnected'
import { ChatTopicCreateModalConnected as ChatTopicCreateModal } from 'thefactory-ui/web'
import { LoadingScreen } from 'thefactory-ui/web'

const LAST_SELECTED_KEY = 'chat-last-selected-context'
const LAST_OPENED_PREFIX = 'chat-last-opened'

function readLastSelected(): ChatContext | undefined {
  try {
    const raw = window.localStorage.getItem(LAST_SELECTED_KEY)
    return raw ? (JSON.parse(raw) as ChatContext) : undefined
  } catch {
    return undefined
  }
}

function writeLastSelected(ctx: ChatContext) {
  try {
    window.localStorage.setItem(LAST_SELECTED_KEY, JSON.stringify(ctx))
  } catch {
    /* unavailable */
  }
}

function readLastOpened(projectId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(`${LAST_OPENED_PREFIX}:${projectId}`)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeLastOpened(projectId: string, key: string) {
  try {
    const map = readLastOpened(projectId)
    map[key] = new Date().toISOString()
    window.localStorage.setItem(`${LAST_OPENED_PREFIX}:${projectId}`, JSON.stringify(map))
  } catch {
    /* unavailable */
  }
}

function lastOpenedFor(
  projectId: string,
  chats: Array<{ context: ChatContext }>,
): ChatContext | undefined {
  const map = readLastOpened(projectId)
  let bestTs = ''
  let bestCtx: ChatContext | undefined
  for (const c of chats) {
    if (c.context.projectId !== projectId) continue
    const ts = map[getChatContextKey(c.context)]
    if (ts && ts > bestTs) {
      bestTs = ts
      bestCtx = c.context
    }
  }
  return bestCtx
}

export default function ChatView() {
  const { projectId } = useActiveProject()
  const params = useParams<{ projectId: string; contextKey?: string }>()
  const navigate = useNavigate()
  const { isLoaded, loadError, projectChat, chats, getChat } = useChats()
  const { rateRun } = useAgents()

  /**
   * Active chat context. Order of preference:
   *   1. URL-encoded `:contextKey` (deep link) → parsed via `getChatContext`.
   *   2. Last-selected context for this project (localStorage).
   *   3. Most-recently-opened chat under this project.
   *   4. The project chat, if one exists.
   *   5. A synthetic project context for the active project (so the very
   *      first send creates the project chat server-side).
   */
  const activeContext = useMemo<ChatContext | null>(() => {
    if (params.contextKey) {
      try {
        return getChatContext(params.contextKey) ?? null
      } catch {
        return null
      }
    }
    if (!projectId) return null
    // Only honor a remembered selection if that chat still exists — otherwise a
    // just-deleted chat (still in lastSelected/lastOpened) would be re-resolved
    // and the UI would re-land on it. A PROJECT context is always valid (the
    // project chat is synthesised when not yet persisted).
    const stillExists = (ctx: ChatContext | undefined): ctx is ChatContext =>
      !!ctx &&
      ctx.projectId === projectId &&
      // An agent-run chat is owned by its pipeline and is no longer listed, so it
      // must never be AUTO-restored as the landing chat (a deep link to it still
      // works — that path returns above).
      !isAgentRunChatContext(ctx) &&
      (ctx.type === 'PROJECT' ||
        chats.some((c) => getChatContextKey(c.context) === getChatContextKey(ctx)))
    const lastSelected = readLastSelected()
    if (stillExists(lastSelected)) return lastSelected
    const lastOpened = lastOpenedFor(projectId, chats)
    if (stillExists(lastOpened)) return lastOpened
    if (projectChat) return projectChat.context
    return { type: 'PROJECT', projectId }
  }, [params.contextKey, projectChat, projectId, chats])

  const onSelectContext = useCallback(
    (ctx: ChatContext) => {
      if (!projectId) return
      const key = getChatContextKey(ctx)
      navigate(`/projects/${projectId}/chat/${encodeURIComponent(key)}`)
    },
    [navigate, projectId],
  )

  // A bare /chat opens the chat it lands on, so the address names it too — a
  // reload, a copied link and Back then agree with what is open.
  useEffect(() => {
    if (params.contextKey || !isLoaded || !activeContext || !projectId) return
    navigate(
      `/projects/${projectId}/chat/${encodeURIComponent(getChatContextKey(activeContext))}`,
      {
        replace: true,
      },
    )
  }, [params.contextKey, isLoaded, activeContext, projectId, navigate])

  // Persist last-selected + last-opened whenever the active chat changes.
  useEffect(() => {
    if (!activeContext) return
    writeLastSelected(activeContext)
    const pid = activeContext.projectId
    if (pid) writeLastOpened(pid, getChatContextKey(activeContext))
  }, [activeContext])

  const listScope = useMemo(
    () => (projectId ? { kind: 'project' as const, projectId } : undefined),
    [projectId],
  )

  const [topicModalOpen, setTopicModalOpen] = useState(false)

  if (!params.contextKey && !isLoaded) return <LoadingScreen label="Loading chat…" />
  if (!params.contextKey && loadError)
    return <LoadingScreen label="Could not load chat" error={loadError.message} />

  if (!activeContext) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center gap-2 p-6">
        <p className="text-sm opacity-70">No project selected.</p>
      </div>
    )
  }

  const chat = getChat(activeContext)
  const isAgentRunChat =
    activeContext.type === 'AGENT_RUN_STORY' || activeContext.type === 'AGENT_RUN_FEATURE'
  const isRunningAgent = isAgentRunChat && (chat?.state === 'created' || chat?.state === 'running')

  const header = (
    <ChatHeaderConnected
      context={activeContext}
      onOpenChat={onSelectContext}
      onDeleted={() => {
        if (projectId) navigate(`/projects/${projectId}/chat`)
      }}
    />
  )

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <aside
        className="hidden md:flex w-72 shrink-0 flex-col overflow-hidden border-r"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)' }}
      >
        {listScope ? (
          <ChatList
            scope={listScope}
            activeKey={getChatContextKey(activeContext)}
            onOpen={onSelectContext}
            onNewChat={() => setTopicModalOpen(true)}
          />
        ) : null}
      </aside>

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <ChatBodyForContext
          context={activeContext}
          header={header}
          inputProps={{ autoFocus: true }}
        />

        {isAgentRunChat && !isRunningAgent && chat ? (
          <div
            className="shrink-0 flex items-center justify-end gap-1 px-3 py-1 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <AgentRunHeaderActions
              rating={chat.rating?.score ?? 0}
              onRate={(score) => void rateRun(chat, score)}
            />
          </div>
        ) : null}

        <ChatTopicCreateModal
          isOpen={topicModalOpen}
          onClose={() => setTopicModalOpen(false)}
          onCreated={(c) => {
            setTopicModalOpen(false)
            onSelectContext(c.context)
          }}
        />
      </div>
    </div>
  )
}

function AgentRunHeaderActions({
  rating,
  onRate,
}: {
  rating: number
  onRate: (score: number) => void
}) {
  // No Delete here: an agent-run chat is deleted WITH its process from the
  // pipeline head, never on its own from the chat surface. Rating stays.
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Thumbs up"
        aria-pressed={rating > 0}
        onClick={() => onRate(rating > 0 ? 0 : 1)}
        className="px-1 py-0.5 rounded text-xs"
        style={{ opacity: rating > 0 ? 1 : 0.5 }}
      >
        👍
      </button>
      <button
        type="button"
        aria-label="Thumbs down"
        aria-pressed={rating < 0}
        onClick={() => onRate(rating < 0 ? 0 : -1)}
        className="px-1 py-0.5 rounded text-xs"
        style={{ opacity: rating < 0 ? 1 : 0.5 }}
      >
        👎
      </button>
    </div>
  )
}
