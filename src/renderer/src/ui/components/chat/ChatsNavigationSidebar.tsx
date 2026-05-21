import { useCallback, useEffect, useMemo, useState } from 'react'
import { useChats } from '@core/contexts/ChatsContext'
import { useStories } from '@core/contexts/StoriesContext'
import { useChatRowStatus } from '@core/notifications/useChatRowStatus'
import { getChatContextKey } from '@core/chats/chatKey'
import type { ChatContext, GetChatResponse, GetStoryResponse } from 'thefactory-ui/headless/api'
import { NotificationBadge, SpinnerWithDot } from 'thefactory-ui/web'
import { IconChevron } from 'thefactory-ui/web/icons'

type SidebarMode = 'categories' | 'history'
const SIDEBAR_OPEN_PREFIX = 'chat-nav-open'

function readOpenState(projectId: string | undefined, mode: SidebarMode): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(
      `${SIDEBAR_OPEN_PREFIX}:${projectId ?? 'noproj'}:${mode}`,
    )
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function writeOpenState(
  projectId: string | undefined,
  mode: SidebarMode,
  open: Record<string, boolean>,
): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      `${SIDEBAR_OPEN_PREFIX}:${projectId ?? 'noproj'}:${mode}`,
      JSON.stringify(open),
    )
  } catch {
    /* localStorage unavailable */
  }
}

export type ChatsNavigationSidebarProps = {
  /** The chat the user is currently viewing — highlighted in the list. */
  activeContext: ChatContext
  /** Called when the user picks a different chat. */
  onSelectContext: (ctx: ChatContext) => void
  /** Top-level mode (Categories vs History) — owned by the screen so the
   * mode toggle can sit beside the create-topic button in the screen
   * header. */
  mode: SidebarMode
}

/**
 * Mirrors `overseer-local`'s ChatsNavigationSidebar: chevron-collapsible
 * sections persisted per project + mode, story groups with nested topics /
 * features / agent runs, plus per-row thinking spinner and unread badge.
 */
export default function ChatsNavigationSidebar({
  activeContext,
  onSelectContext,
  mode,
}: ChatsNavigationSidebarProps) {
  const { chats: allChatsGlobal, projectChat } = useChats()
  const { stories, getStory, getFeature } = useStories()
  const activeKey = getChatContextKey(activeContext)
  const projectId = useMemo(() => {
    if (activeContext.projectId) return activeContext.projectId
    if (projectChat) return projectChat.context.projectId
    return undefined
  }, [activeContext.projectId, projectChat])

  // `useChats().chats` is now a global list (loaded across all projects so
  // the sidebar can compute per-project unread badges). The chat list on
  // THIS screen, though, must only show the active project's chats —
  // otherwise the sidebar surfaces every other project's topics, agent
  // runs, and group chats under the current project's header. Filter
  // here so the rest of the sidebar machinery stays project-scoped.
  const chats = useMemo(
    () => (projectId ? allChatsGlobal.filter((c) => c.context.projectId === projectId) : []),
    [allChatsGlobal, projectId],
  )

  const [open, setOpen] = useState<Record<string, boolean>>(() => readOpenState(projectId, mode))

  useEffect(() => {
    setOpen(readOpenState(projectId, mode))
  }, [projectId, mode])

  useEffect(() => {
    writeOpenState(projectId, mode, open)
  }, [projectId, mode, open])

  // Auto-expand sections containing the active chat — so deep links land on
  // an already-revealed row.
  useEffect(() => {
    const keys = computeKeysForContext(activeContext)
    if (keys.length === 0) return
    setOpen((prev) => {
      let changed = false
      const next = { ...prev }
      for (const k of keys) {
        if (!next[k]) {
          next[k] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [activeContext])

  const toggle = useCallback((key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const grouped = useMemo(() => groupChats(chats, stories), [chats, stories])

  const allChats = useMemo(() => {
    // `chats` already includes the project chat when it exists — don't prepend
    // it again, that produces a duplicate row in History.
    const projectKey = projectChat ? getChatContextKey(projectChat.context) : undefined
    const seen = new Set<string>()
    const out: GetChatResponse[] = []
    for (const c of chats) {
      const k = getChatContextKey(c.context)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(c)
    }
    if (projectChat && !seen.has(projectKey!)) out.unshift(projectChat)
    return out.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }, [chats, projectChat])

  return (
    <div className="flex-1 overflow-auto px-2 pb-3 space-y-3">
      {mode === 'history' ? (
        <HistoryList
          chats={allChats}
          activeKey={activeKey}
          onSelectContext={onSelectContext}
          getStory={getStory}
          getFeature={getFeature}
        />
      ) : (
        <CategoriesList
          projectChat={projectChat}
          grouped={grouped}
          open={open}
          toggle={toggle}
          activeKey={activeKey}
          onSelectContext={onSelectContext}
          getStory={getStory}
          getFeature={getFeature}
        />
      )}
    </div>
  )
}

function SectionHeader({
  title,
  openKey,
  isOpen,
  onToggle,
}: {
  title: string
  openKey?: string
  isOpen: boolean
  onToggle?: (key: string) => void
}) {
  const interactive = !!openKey && !!onToggle
  return (
    <div className="px-2 py-1 border-b border-(--border-subtle)">
      <button
        type="button"
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider opacity-70 hover:opacity-100 disabled:opacity-70"
        onClick={() => interactive && openKey && onToggle(openKey)}
        aria-expanded={isOpen}
        aria-controls={openKey ? `${openKey}-section` : undefined}
        disabled={!interactive}
      >
        {interactive && (
          <IconChevron
            className="w-3 h-3"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        )}
        <span className="font-semibold">{title}</span>
      </button>
    </div>
  )
}

function ChatRow({
  ctx,
  title,
  isActive,
  onSelect,
  updatedAt,
  messageCount,
}: {
  ctx: ChatContext
  title: string
  isActive: boolean
  onSelect: () => void
  updatedAt?: string
  messageCount?: number
}) {
  const { isThinking, isUnread, unreadCount, isAgentRunning } = useChatRowStatus(ctx)
  const cap = (n: number) => (n > 99 ? '99+' : `${n}`)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive ? 'true' : undefined}
      title={title}
      className={[
        'w-full text-left rounded-md px-3 py-2 border shadow-sm transition-colors',
        isActive
          ? 'border-(--accent-primary) bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
          : 'border-(--border-subtle) bg-(--surface-raised) hover:border-(--border-default)',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[12px] font-medium text-(--text-primary) truncate">{title}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {typeof messageCount === 'number' && messageCount > 0 ? (
            <span
              className="text-[10px] tabular-nums text-(--text-secondary) bg-(--surface-overlay) border border-(--border-subtle) rounded-full px-1.5 py-[1px]"
              title={`${messageCount} messages`}
            >
              {messageCount}
            </span>
          ) : null}
          {isAgentRunning || isThinking ? (
            <SpinnerWithDot size={14} showDot={isUnread} />
          ) : isUnread ? (
            <NotificationBadge
              className="h-[16px] min-w-[16px] px-1 text-[10px]"
              text={cap(unreadCount)}
              tooltipLabel={`${unreadCount} unread messages`}
            />
          ) : null}
        </div>
      </div>
      {updatedAt ? (
        <div className="text-[10px] text-(--text-tertiary) truncate mt-0.5">
          Updated {formatRelativeTime(updatedAt)}
        </div>
      ) : null}
    </button>
  )
}

function formatRelativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime()
    if (Number.isNaN(then)) return iso
    const diff = Date.now() - then
    const secs = Math.floor(diff / 1000)
    if (secs < 60) return 'just now'
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

function CategoriesList({
  projectChat,
  grouped,
  open,
  toggle,
  activeKey,
  onSelectContext,
  getStory,
  getFeature,
}: {
  projectChat: GetChatResponse | null
  grouped: GroupedChats
  open: Record<string, boolean>
  toggle: (key: string) => void
  activeKey: string
  onSelectContext: (ctx: ChatContext) => void
  getStory: (id: string) => GetStoryResponse | undefined
  getFeature: (storyId: string, featureId: string) => { title?: string } | undefined
}) {
  return (
    <>
      <div className="space-y-1">
        <SectionHeader title="General" isOpen={true} />
        <div className="space-y-1">
          {projectChat ? (
            <ChatRow
              ctx={projectChat.context}
              title="Project chat"
              messageCount={projectChat.messages?.length ?? 0}
              isActive={getChatContextKey(projectChat.context) === activeKey}
              onSelect={() => onSelectContext(projectChat.context)}
            />
          ) : (
            <p className="text-xs opacity-60 px-1 py-1">
              Send a message in the project to create the project chat.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <SectionHeader
          title="Topics"
          openKey="cat:project-topics"
          isOpen={!!open['cat:project-topics']}
          onToggle={toggle}
        />
        {open['cat:project-topics'] && (
          <div id="cat:project-topics-section" className="space-y-1">
            {grouped.topics.length === 0 ? (
              <p className="text-xs opacity-60 px-1 py-1">No topics yet.</p>
            ) : (
              grouped.topics.map((c) => (
                <ChatRow
                  key={getChatContextKey(c.context)}
                  ctx={c.context}
                  title={c.title ?? 'Untitled topic'}
                  isActive={getChatContextKey(c.context) === activeKey}
                  onSelect={() => onSelectContext(c.context)}
                  messageCount={c.messages?.length ?? 0}
                />
              ))
            )}
          </div>
        )}
      </div>

      {grouped.byStory.length > 0 && (
        <div className="space-y-1">
          <SectionHeader
            title="Stories"
            openKey="cat:stories"
            isOpen={!!open['cat:stories']}
            onToggle={toggle}
          />
          {open['cat:stories'] && (
            <div id="cat:stories-section" className="space-y-2">
              {grouped.byStory.map((entry, idx) => {
                const story = getStory(entry.storyId)
                return (
                  <StoryGroup
                    key={entry.storyId}
                    storyId={entry.storyId}
                    storyTitle={story?.title ?? entry.storyId.slice(0, 8)}
                    storyIndex={idx + 1}
                    entry={entry}
                    open={open}
                    toggle={toggle}
                    activeKey={activeKey}
                    onSelectContext={onSelectContext}
                    getFeatureTitle={(featureId) =>
                      getFeature(entry.storyId, featureId)?.title ?? featureId.slice(0, 8)
                    }
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function StoryGroup({
  storyId,
  storyTitle,
  storyIndex,
  entry,
  open,
  toggle,
  activeKey,
  onSelectContext,
  getFeatureTitle,
}: {
  storyId: string
  storyTitle: string
  storyIndex?: number
  entry: StoryGroupEntry
  open: Record<string, boolean>
  toggle: (key: string) => void
  activeKey: string
  onSelectContext: (ctx: ChatContext) => void
  getFeatureTitle: (featureId: string) => string
}) {
  const storyKey = `story:${storyId}`
  const isOpen = !!open[storyKey]
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => toggle(storyKey)}
        aria-expanded={isOpen}
        aria-controls={`${storyKey}-section`}
        title={storyTitle}
        className="w-full flex items-center justify-between rounded-md border bg-(--surface-raised) px-2 py-1.5 text-left text-[12px] font-semibold text-(--text-primary) border-(--border-subtle) hover:border-(--border-default)"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <IconChevron
            className="w-3 h-3 flex-none"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
          <span className="truncate">{storyTitle}</span>
        </div>
        {typeof storyIndex === 'number' && (
          <span className="ml-2 text-[10px] tabular-nums opacity-60 font-mono">{storyIndex}</span>
        )}
      </button>
      {isOpen && (
        <div
          id={`${storyKey}-section`}
          className="pl-3 space-y-1 border-l border-(--border-subtle)"
        >
          {entry.storyChats.map((c) => (
            <ChatRow
              key={getChatContextKey(c.context)}
              ctx={c.context}
              title="Story chat"
              isActive={getChatContextKey(c.context) === activeKey}
              onSelect={() => onSelectContext(c.context)}
              messageCount={c.messages?.length ?? 0}
            />
          ))}
          {entry.agentRuns.length > 0 && (
            <NestedSection
              title="Agent Runs"
              storageKey={`${storyKey}:runs`}
              open={open}
              toggle={toggle}
            >
              {entry.agentRuns.map((c) => (
                <ChatRow
                  key={getChatContextKey(c.context)}
                  ctx={c.context}
                  title={agentRunTitle(c)}
                  isActive={getChatContextKey(c.context) === activeKey}
                  onSelect={() => onSelectContext(c.context)}
                  messageCount={c.messages?.length ?? 0}
                />
              ))}
            </NestedSection>
          )}
          {entry.featureGroups.length > 0 && (
            <NestedSection
              title="Features"
              storageKey={`${storyKey}:features`}
              open={open}
              toggle={toggle}
            >
              {entry.featureGroups.map((fg) => (
                <div key={fg.featureId} className="space-y-1">
                  <div className="px-1 py-0.5 text-[11px] font-medium opacity-80 truncate">
                    {getFeatureTitle(fg.featureId)}
                  </div>
                  {fg.chats.map((c) => (
                    <ChatRow
                      key={getChatContextKey(c.context)}
                      ctx={c.context}
                      title={
                        c.context.type === 'FEATURE'
                          ? `Feature: ${getFeatureTitle(fg.featureId)}`
                          : agentRunTitle(c)
                      }
                      isActive={getChatContextKey(c.context) === activeKey}
                      onSelect={() => onSelectContext(c.context)}
                      messageCount={c.messages?.length ?? 0}
                    />
                  ))}
                </div>
              ))}
            </NestedSection>
          )}
        </div>
      )}
    </div>
  )
}

function NestedSection({
  title,
  storageKey,
  open,
  toggle,
  children,
}: {
  title: string
  storageKey: string
  open: Record<string, boolean>
  toggle: (key: string) => void
  children: React.ReactNode
}) {
  const isOpen = !!open[storageKey]
  return (
    <div className="space-y-1">
      <SectionHeader title={title} openKey={storageKey} isOpen={isOpen} onToggle={toggle} />
      {isOpen && (
        <div id={`${storageKey}-section`} className="space-y-1">
          {children}
        </div>
      )}
    </div>
  )
}

function HistoryList({
  chats,
  activeKey,
  onSelectContext,
  getStory,
  getFeature,
}: {
  chats: GetChatResponse[]
  activeKey: string
  onSelectContext: (ctx: ChatContext) => void
  getStory: (id: string) => GetStoryResponse | undefined
  getFeature: (storyId: string, featureId: string) => { title?: string } | undefined
}) {
  if (chats.length === 0) {
    return <p className="text-xs opacity-60 px-1 py-3">No chats yet for this project.</p>
  }
  return (
    <div className="space-y-1 pt-1">
      {chats.map((c) => (
        <ChatRow
          key={getChatContextKey(c.context)}
          ctx={c.context}
          title={historyRowTitle(c, getStory, getFeature)}
          isActive={getChatContextKey(c.context) === activeKey}
          onSelect={() => onSelectContext(c.context)}
          updatedAt={c.updatedAt || c.createdAt || ''}
          messageCount={c.messages?.length ?? 0}
        />
      ))}
    </div>
  )
}

function agentRunTitle(chat: GetChatResponse): string {
  const runId = chat.context.agentRunId
  return chat.context.type === 'AGENT_RUN_FEATURE'
    ? `Agent run (feature) · ${runId?.slice(0, 6) ?? '?'}`
    : `Agent run · ${runId?.slice(0, 6) ?? '?'}`
}

function historyRowTitle(
  chat: GetChatResponse,
  getStory: (id: string) => GetStoryResponse | undefined,
  getFeature: (storyId: string, featureId: string) => { title?: string } | undefined,
): string {
  const ctx = chat.context
  switch (ctx.type) {
    case 'PROJECT':
      return 'Project chat'
    case 'PROJECT_TOPIC':
      return chat.title ?? 'Untitled topic'
    case 'STORY':
      return ctx.storyId
        ? `Story: ${getStory(ctx.storyId)?.title ?? ctx.storyId.slice(0, 8)}`
        : 'Story chat'
    case 'FEATURE':
      if (ctx.storyId && ctx.featureId) {
        const featureTitle =
          getFeature(ctx.storyId, ctx.featureId)?.title ?? ctx.featureId.slice(0, 8)
        return `Feature: ${featureTitle}`
      }
      return 'Feature chat'
    case 'AGENT_RUN_STORY':
    case 'AGENT_RUN_FEATURE':
      return agentRunTitle(chat)
    default:
      return chat.title ?? 'Chat'
  }
}

function computeKeysForContext(ctx: ChatContext): string[] {
  const keys: string[] = []
  switch (ctx.type) {
    case 'PROJECT_TOPIC':
      keys.push('cat:project-topics')
      break
    case 'STORY':
      keys.push('cat:stories', `story:${ctx.storyId}`)
      break
    case 'FEATURE':
      keys.push('cat:stories', `story:${ctx.storyId}`, `story:${ctx.storyId}:features`)
      break
    case 'AGENT_RUN_STORY':
      keys.push('cat:stories', `story:${ctx.storyId}`, `story:${ctx.storyId}:runs`)
      break
    case 'AGENT_RUN_FEATURE':
      keys.push('cat:stories', `story:${ctx.storyId}`, `story:${ctx.storyId}:features`)
      break
    default:
      break
  }
  return keys
}

type StoryGroupEntry = {
  storyId: string
  storyChats: GetChatResponse[]
  featureGroups: { featureId: string; chats: GetChatResponse[] }[]
  agentRuns: GetChatResponse[]
}

type GroupedChats = {
  topics: GetChatResponse[]
  byStory: StoryGroupEntry[]
}

function groupChats(chats: GetChatResponse[], stories: GetStoryResponse[]): GroupedChats {
  const topics: GetChatResponse[] = []
  const storyMap = new Map<string, StoryGroupEntry>()
  const ensure = (storyId: string): StoryGroupEntry => {
    let entry = storyMap.get(storyId)
    if (!entry) {
      entry = { storyId, storyChats: [], featureGroups: [], agentRuns: [] }
      storyMap.set(storyId, entry)
    }
    return entry
  }
  const ensureFeatureGroup = (
    entry: StoryGroupEntry,
    featureId: string,
  ): { featureId: string; chats: GetChatResponse[] } => {
    let fg = entry.featureGroups.find((f) => f.featureId === featureId)
    if (!fg) {
      fg = { featureId, chats: [] }
      entry.featureGroups.push(fg)
    }
    return fg
  }

  for (const chat of chats) {
    const ctx = chat.context
    switch (ctx.type) {
      case 'PROJECT_TOPIC':
        topics.push(chat)
        break
      case 'STORY':
        if (ctx.storyId) ensure(ctx.storyId).storyChats.push(chat)
        break
      case 'FEATURE':
        if (ctx.storyId && ctx.featureId)
          ensureFeatureGroup(ensure(ctx.storyId), ctx.featureId).chats.push(chat)
        break
      case 'AGENT_RUN_STORY':
      case 'AGENT_RUN_FEATURE':
        if (ctx.storyId) ensure(ctx.storyId).agentRuns.push(chat)
        break
      default:
        break
    }
  }

  const storyIndex = new Map<string, number>()
  stories.forEach((s, i) => storyIndex.set(s.id, i))
  const byStory = Array.from(storyMap.values()).sort((a, b) => {
    const ai = storyIndex.get(a.storyId) ?? Number.MAX_SAFE_INTEGER
    const bi = storyIndex.get(b.storyId) ?? Number.MAX_SAFE_INTEGER
    return ai - bi
  })

  topics.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  return { topics, byStory }
}
