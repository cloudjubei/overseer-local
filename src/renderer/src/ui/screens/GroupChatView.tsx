import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChatList } from 'thefactory-ui/web'
import type { ChatContext, ChatContextGroup } from 'thefactory-ui/headless/api'
import { useChats } from 'thefactory-ui/headless'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { useChatContextLastRead as useChatLastRead } from 'thefactory-ui/web'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'
import ChatHeaderConnected from '@ui/components/chat/ChatHeaderConnected'
import { ChatTopicCreateModalConnected as ChatTopicCreateModal } from 'thefactory-ui/web'
import { LoadingScreen } from 'thefactory-ui/web'

const LAST_SELECTED_PREFIX = 'group-chat-last-selected-context'
const LAST_OPENED_PREFIX = 'group-chat-last-opened'

function readLastSelected(groupId: string): ChatContext | undefined {
  try {
    const raw = window.localStorage.getItem(`${LAST_SELECTED_PREFIX}:${groupId}`)
    return raw ? (JSON.parse(raw) as ChatContext) : undefined
  } catch {
    return undefined
  }
}

function writeLastSelected(groupId: string, ctx: ChatContext) {
  try {
    window.localStorage.setItem(`${LAST_SELECTED_PREFIX}:${groupId}`, JSON.stringify(ctx))
  } catch {
    /* unavailable */
  }
}

function readLastOpened(groupId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(`${LAST_OPENED_PREFIX}:${groupId}`)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function writeLastOpened(groupId: string, key: string) {
  try {
    const map = readLastOpened(groupId)
    map[key] = new Date().toISOString()
    window.localStorage.setItem(`${LAST_OPENED_PREFIX}:${groupId}`, JSON.stringify(map))
  } catch {
    /* unavailable */
  }
}

function lastOpenedFor(
  groupId: string,
  chats: Array<{ context: ChatContext }>,
): ChatContext | undefined {
  const map = readLastOpened(groupId)
  let bestTs = ''
  let bestCtx: ChatContext | undefined
  for (const c of chats) {
    const cg = (c.context as { groupId?: string }).groupId
    if (cg !== groupId) continue
    const ts = map[getChatContextKey(c.context)]
    if (ts && ts > bestTs) {
      bestTs = ts
      bestCtx = c.context
    }
  }
  return bestCtx
}

/**
 * Group-scope chat view. Mirrors desktop's `ChatView` when
 * `activeSelectionType === 'group'`: same chrome (sidebar of group chats +
 * header + body + settings dropdown + modals) — just scoped to a
 * `{ type: 'GROUP' | 'GROUP_TOPIC', groupId }` context instead of a
 * project one.
 *
 * Kept as a separate file from `ChatView` because the surrounding
 * machinery (story/feature resolution, project chat picker, project-back
 * navigation) doesn't apply at group scope.
 */
export default function GroupChatView() {
  const { groupId, contextKey } = useParams<{ groupId: string; contextKey?: string }>()
  const navigate = useNavigate()
  const { groups } = useProjectsGroups()
  const { isLoaded, loadError, chats } = useChats()

  const group = useMemo(
    () => (groupId ? groups.find((g) => g.id === groupId) : undefined),
    [groups, groupId],
  )

  /** Active chat context. Order: URL `:contextKey` → last-selected for group
   *  → most-recently-opened group chat → synthetic GROUP context. */
  const activeContext = useMemo<ChatContext | null>(() => {
    if (contextKey) {
      try {
        return getChatContext(contextKey) ?? null
      } catch {
        return null
      }
    }
    if (!groupId) return null
    const lastSelected = readLastSelected(groupId)
    if (lastSelected && (lastSelected as { groupId?: string }).groupId === groupId) {
      return lastSelected
    }
    const lastOpened = lastOpenedFor(groupId, chats)
    if (lastOpened) return lastOpened
    return { type: 'GROUP', groupId } as ChatContextGroup
  }, [contextKey, groupId, chats])

  const onSelectContext = useCallback(
    (ctx: ChatContext) => {
      if (!groupId) return
      const key = getChatContextKey(ctx)
      navigate(`/groups/${groupId}/chat/${encodeURIComponent(key)}`)
    },
    [navigate, groupId],
  )

  // Persist last-selected + last-opened whenever the active chat changes.
  useEffect(() => {
    if (!activeContext || !groupId) return
    writeLastSelected(groupId, activeContext)
    writeLastOpened(groupId, getChatContextKey(activeContext))
  }, [activeContext, groupId])

  const [topicModalOpen, setTopicModalOpen] = useState(false)

  const listScope = useMemo(
    () =>
      group ? { kind: 'group' as const, groupId: group.id, projectIds: group.projects } : undefined,
    [group],
  )
  const onOpenListed = useCallback(
    (ctx: ChatContext) => {
      if (ctx.projectId && !ctx.groupId) {
        navigate(`/projects/${ctx.projectId}/chat/${encodeURIComponent(getChatContextKey(ctx))}`)
        return
      }
      onSelectContext(ctx)
    },
    [navigate, onSelectContext],
  )

  useChatLastRead(activeContext ?? undefined)

  if (!contextKey && !isLoaded) return <LoadingScreen label="Loading chat…" />
  if (!contextKey && loadError)
    return <LoadingScreen label="Could not load chat" error={loadError.message} />

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center opacity-70 gap-2">
        <h2 className="text-lg font-semibold">Group not found</h2>
      </div>
    )
  }
  if (!activeContext) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center opacity-70 gap-2">
        <h2 className="text-lg font-semibold">No chat selected</h2>
      </div>
    )
  }

  const header = (
    <ChatHeaderConnected
      context={activeContext}
      onOpenChat={onSelectContext}
      onDeleted={() => {
        if (groupId) navigate(`/groups/${groupId}/chat`)
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
            groupName={group.title}
            activeKey={getChatContextKey(activeContext)}
            onOpen={onOpenListed}
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

        <ChatTopicCreateModal
          isOpen={topicModalOpen}
          onClose={() => setTopicModalOpen(false)}
          scope={{ kind: 'group', groupId: groupId! }}
          onCreated={(c) => {
            setTopicModalOpen(false)
            onSelectContext(c.context)
          }}
        />
      </div>
    </div>
  )
}
