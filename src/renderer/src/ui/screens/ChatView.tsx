import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAgents } from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { formatChatTitle } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContext, getChatContextKey } from '@core/chats/chatKey'
import { Button, ChatHeader, DotBadge, SegmentedControl } from 'thefactory-ui/web'
import { IconPlus } from 'thefactory-ui/web/icons'
import { useBadgeCounts } from '@core/notifications/useBadgeCounts'
import ChatBodyForContext from '@ui/components/chat/ChatBodyForContext'
import { ChatDynamicContextModal } from 'thefactory-ui/web'
import ChatsNavigationSidebar from '@ui/components/chat/ChatsNavigationSidebar'
import ChatSettingsDropdownConnected from '@ui/components/chat/ChatSettingsDropdownConnected'
import { ChatTopicCreateModalConnected as ChatTopicCreateModal } from 'thefactory-ui/web'
import { SystemPromptViewerConnected } from 'thefactory-ui/web'
import { UsageModalConnected as UsageModal } from 'thefactory-ui/web'
import { ContextInfoButton } from 'thefactory-ui/web'
import ModelChipConnected from '@ui/components/agents/ModelChipConnected'
import { LoadingScreen } from 'thefactory-ui/web'

const SIDEBAR_MODE_KEY = 'chat-sidebar-mode'
const LAST_SELECTED_KEY = 'chat-last-selected-context'
const LAST_OPENED_PREFIX = 'chat-last-opened'

function readSidebarMode(): 'categories' | 'history' {
  if (typeof window === 'undefined') return 'categories'
  return window.localStorage.getItem(SIDEBAR_MODE_KEY) === 'history' ? 'history' : 'categories'
}

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
  const { project, projectId } = useActiveProject()
  const params = useParams<{ projectId: string; contextKey?: string }>()
  const navigate = useNavigate()
  const { storyDisplayIndex, featureDisplayIndex } = useStories()
  const { isLoaded, loadError, projectChat, chats, getChat, clearChat, deleteChat } = useChats()
  const { counts } = useBadgeCounts()
  const { deleteRun, rateRun } = useAgents()

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
    const lastSelected = readLastSelected()
    if (lastSelected && lastSelected.projectId === projectId) return lastSelected
    const lastOpened = lastOpenedFor(projectId, chats)
    if (lastOpened) return lastOpened
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

  // Persist last-selected + last-opened whenever the active chat changes.
  useEffect(() => {
    if (!activeContext) return
    writeLastSelected(activeContext)
    const pid = activeContext.projectId
    if (pid) writeLastOpened(pid, getChatContextKey(activeContext))
  }, [activeContext])

  const [sidebarMode, setSidebarMode] = useState<'categories' | 'history'>(() => readSidebarMode())
  const onChangeSidebarMode = (next: 'categories' | 'history') => {
    setSidebarMode(next)
    try {
      window.localStorage.setItem(SIDEBAR_MODE_KEY, next)
    } catch {
      /* localStorage unavailable */
    }
  }

  const [usageOpen, setUsageOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [topicModalOpen, setTopicModalOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [dynamicContextOpen, setDynamicContextOpen] = useState(false)
  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)

  if (!isLoaded) return <LoadingScreen label="Loading chat…" />
  if (loadError) return <LoadingScreen label="Could not load chat" error={loadError.message} />

  if (!activeContext) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center gap-2 p-6">
        <p className="text-sm opacity-70">No project selected.</p>
      </div>
    )
  }

  const chat = getChat(activeContext)
  const messages = chat?.messages ?? []
  const isAgentRunChat =
    activeContext.type === 'AGENT_RUN_STORY' || activeContext.type === 'AGENT_RUN_FEATURE'
  const isRunningAgent = isAgentRunChat && (chat?.state === 'created' || chat?.state === 'running')

  const totalCost = messages.reduce((sum, m) => sum + (m.usage?.cost ?? 0), 0)
  const titleHint = formatChatTitle({
    context: activeContext,
    chatTitle: chat?.title,
    projectName: project?.title,
    storyDisplayIndex,
    featureDisplayIndex,
  })

  const header = (
    <ChatHeader
      isCollapsible={false}
      totalCostUSD={totalCost}
      title={titleHint}
      contextInfoSlot={
        <ContextInfoButton
          storyId={activeContext.storyId}
          featureId={activeContext.featureId}
          label={titleHint}
        />
      }
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
      isRunningAgent={isRunningAgent}
      modelChip={<ModelChipConnected editable className="border-blue-500" mode="chat" />}
      settingsDropdown={
        <ChatSettingsDropdownConnected
          context={activeContext}
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          settingsBtnRef={settingsBtnRef}
          onDeleteChat={async () => {
            if (activeContext.type === 'PROJECT') {
              window.alert('The General chat cannot be deleted.')
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
            // Navigate back to the canonical project chat.
            if (projectId) navigate(`/projects/${projectId}/chat`)
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
          className="px-2 py-2 border-b shrink-0 flex items-center gap-2"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex-1 min-w-0 relative">
            <SegmentedControl
              size="sm"
              ariaLabel="Chats sidebar mode"
              value={sidebarMode}
              onChange={(v) => onChangeSidebarMode(v as 'categories' | 'history')}
              options={[
                { value: 'categories', label: 'Categories' },
                { value: 'history', label: 'History' },
              ]}
            />
            {counts.chat > 0 ? (
              <DotBadge
                title={`${counts.chat} unread chat${counts.chat === 1 ? '' : 's'}`}
                colorClass="bg-red-500"
                className="absolute -top-1 -right-1 w-[6px] h-[6px]"
              />
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setTopicModalOpen(true)}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) transition-colors focus:outline-none focus:ring-2 focus:ring-(--accent-primary)"
            aria-label="Create custom chat topic"
            title="Create custom chat topic"
          >
            <IconPlus className="w-5 h-5" />
          </button>
        </div>
        <ChatsNavigationSidebar
          activeContext={activeContext}
          onSelectContext={onSelectContext}
          mode={sidebarMode}
        />
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
              onDelete={() => {
                if (window.confirm('Delete this agent run? Messages will be removed.')) {
                  void deleteRun(chat).then(() => {
                    if (projectId) navigate(`/projects/${projectId}/chat`)
                  })
                }
              }}
            />
          </div>
        ) : null}

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
  onDelete,
}: {
  rating: number
  onRate: (score: number) => void
  onDelete: () => void
}) {
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
      <Button size="sm" variant="ghost" onClick={onDelete} aria-label="Delete agent run">
        Delete
      </Button>
    </div>
  )
}

