import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChatHeader } from 'thefactory-ui/web'
import { IconPlus } from 'thefactory-ui/web/icons'
import type { ChatContext, ChatContextGroup, GetChatResponse } from 'thefactory-ui/headless/api'
import { useChats } from 'thefactory-ui/headless'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { useChatLastRead } from '@core/notifications/useChatLastRead'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'
import { ChatDynamicContextModal } from 'thefactory-ui/web'
import ChatSettingsDropdownConnected from '@ui/components/chat/ChatSettingsDropdownConnected'
import { ChatTopicCreateModalConnected as ChatTopicCreateModal } from 'thefactory-ui/web'
import { SystemPromptViewerConnected } from 'thefactory-ui/web'
import { UsageModalConnected as UsageModal } from 'thefactory-ui/web'
import ModelChip from '@ui/components/agents/ModelChip'
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
  const { isLoaded, loadError, chats, getChat, clearChat, deleteChat } = useChats()

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

  const [usageOpen, setUsageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [dynamicContextOpen, setDynamicContextOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)

  useChatLastRead(activeContext ?? undefined)

  if (!isLoaded) return <LoadingScreen label="Loading chat…" />
  if (loadError) return <LoadingScreen label="Could not load chat" error={loadError.message} />

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

  const chat = getChat(activeContext)
  const messages = chat?.messages ?? []
  const totalCost = messages.reduce((sum, m) => sum + (m.usage?.cost ?? 0), 0)

  const groupChats = chats
    .filter((c) => (c.context as { groupId?: string }).groupId === groupId)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  const header = (
    <ChatHeader
      isCollapsible={false}
      totalCostUSD={totalCost}
      onOpenPrompt={() => setPromptOpen(true)}
      onOpenCosts={() => setUsageOpen(true)}
      onOpenDynamicContext={() => setDynamicContextOpen(true)}
      onRefresh={() => {
        if (window.confirm('Clear all messages in this chat? This cannot be undone.')) {
          void clearChat(activeContext)
        }
      }}
      onOpenSettings={() => setSettingsOpen((v) => !v)}
      settingsBtnRef={settingsBtnRef}
      isSettingsOpen={settingsOpen}
      modelChip={<ModelChip editable className="border-blue-500" mode="chat" />}
      settingsDropdown={
        <ChatSettingsDropdownConnected
          context={activeContext}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settingsBtnRef={settingsBtnRef}
          onDeleteChat={async () => {
            if (activeContext.type === 'GROUP') {
              window.alert('The group chat cannot be deleted.')
              return
            }
            const confirmed = window.confirm('Delete this chat? This action cannot be undone.')
            if (!confirmed) return
            setSettingsOpen(false)
            try {
              await deleteChat(activeContext)
            } catch (e) {
              console.error('Failed to delete chat', e)
              window.alert('Failed to delete chat. Please try again.')
              return
            }
            if (groupId) navigate(`/groups/${groupId}/chat`)
          }}
        />
      }
    />
  )

  return (
    <div className="flex flex-row w-full h-full overflow-hidden">
      <aside
        className="hidden md:flex w-64 shrink-0 flex-col overflow-hidden border-r"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-base)' }}
      >
        <div
          className="px-3 py-2 border-b shrink-0 flex items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <span className="flex-1 text-xs uppercase tracking-wide opacity-60 truncate">
            Group chats
          </span>
          <button
            type="button"
            onClick={() => setTopicModalOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent-primary)"
            aria-label="Create custom group topic"
            title="Create custom group topic"
          >
            <IconPlus className="w-5 h-5" />
          </button>
        </div>
        <GroupChatsList
          chats={groupChats}
          groupId={groupId!}
          activeContext={activeContext}
          onSelectContext={onSelectContext}
        />
      </aside>

      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <ChatBodyForContext context={activeContext} header={header} inputProps={{ autoFocus: true }} />

        <UsageModal
          isOpen={usageOpen}
          onClose={() => setUsageOpen(false)}
          messages={messages}
          chatKey={getChatContextKey(activeContext)}
        />

        <SystemPromptViewerConnected
          isOpen={promptOpen}
          onClose={() => setPromptOpen(false)}
          context={activeContext}
        />

        <ChatDynamicContextModal
          isOpen={dynamicContextOpen}
          onClose={() => setDynamicContextOpen(false)}
          context={activeContext}
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

function GroupChatsList({
  chats,
  groupId,
  activeContext,
  onSelectContext,
}: {
  chats: GetChatResponse[]
  groupId: string
  activeContext: ChatContext
  onSelectContext: (ctx: ChatContext) => void
}) {
  const activeKey = getChatContextKey(activeContext)
  const groupChatContext: ChatContextGroup = { type: 'GROUP', groupId }
  const groupKey = getChatContextKey(groupChatContext)
  const hasGroupRow = chats.some((c) => getChatContextKey(c.context) === groupKey)

  return (
    <div className="flex-1 overflow-auto px-2 py-2 space-y-1">
      {!hasGroupRow && (
        <ChatRow
          label="General"
          ctx={groupChatContext}
          isActive={activeKey === groupKey}
          onSelectContext={onSelectContext}
        />
      )}
      {chats.length === 0 && hasGroupRow === false ? (
        <p className="text-xs opacity-60 px-2 py-3">No chats yet.</p>
      ) : (
        chats.map((c) => {
          const k = getChatContextKey(c.context)
          const isGroupCtx = c.context.type === 'GROUP'
          const label = isGroupCtx ? 'General' : (c.title ?? 'Topic')
          return (
            <ChatRow
              key={k}
              label={label}
              ctx={c.context}
              isActive={activeKey === k}
              onSelectContext={onSelectContext}
            />
          )
        })
      )}
    </div>
  )
}

function ChatRow({
  label,
  ctx,
  isActive,
  onSelectContext,
}: {
  label: string
  ctx: ChatContext
  isActive: boolean
  onSelectContext: (ctx: ChatContext) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectContext(ctx)}
      aria-current={isActive ? 'true' : undefined}
      className="w-full text-left px-2 py-1.5 rounded text-sm truncate"
      style={{
        background: isActive ? 'var(--color-brand-50)' : 'transparent',
        color: isActive ? 'var(--color-brand-700)' : 'inherit',
      }}
    >
      {label}
    </button>
  )
}
