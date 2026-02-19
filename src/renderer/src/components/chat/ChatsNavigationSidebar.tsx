import React, { useEffect, useMemo, useState, useCallback, memo } from 'react'
import { useActiveProject, useProjectContext } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-tools'
import { IconChevron } from '@renderer/components/ui/icons/Icons'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import DotBadge from '@renderer/components/ui/DotBadge'
import { getChatContextPath } from 'thefactory-tools/utils'
import NotificationBadge from '@renderer/components/stories/NotificationBadge'
import { useChatThinking } from '@renderer/hooks/useChatThinking'
import SpinnerWithDot from '@renderer/components/ui/SpinnerWithDot'

function prettyTopicName(topic?: string): string {
  if (!topic) return 'Topic'
  return String(topic)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function titleForContext(
  context: ChatContext,
  opts: {
    getProjectTitle: (id?: string) => string
    getStoryTitle: (id?: string) => string
    getFeatureTitle: (id?: string) => string
  },
): string {
  switch (context.type) {
    case 'PROJECT':
      return `Project Chat — ${opts.getProjectTitle(context.projectId)}`
    case 'STORY':
      return `Story Chat — ${opts.getStoryTitle(context.storyId)}`
    case 'FEATURE':
      return `Feature Chat — ${opts.getStoryTitle(context.storyId)} / ${opts.getFeatureTitle(
        context.featureId,
      )}`
    case 'PROJECT_TOPIC':
      return `Project ${prettyTopicName((context as any).projectTopic)} — ${opts.getProjectTitle(
        context.projectId,
      )}`
    case 'STORY_TOPIC':
      return `Story ${prettyTopicName((context as any).storyTopic)} — ${opts.getStoryTitle(
        context.storyId,
      )}`
    case 'AGENT_RUN':
      return `Agent Story Run — ${opts.getStoryTitle(context.storyId)}`
    case 'AGENT_RUN_FEATURE':
      return `Agent Feature Run — ${opts.getStoryTitle(context.storyId)} / ${opts.getFeatureTitle(
        context.featureId,
      )}`
    default:
      return 'Chat'
  }
}

export type ChatsNavigationSidebarProps = {
  selectedContext?: ChatContext
  onSelectContext: (ctx: ChatContext) => void
  mode: 'categories' | 'history'
}

type OpenState = Record<string, boolean>

type StoryGroup = {
  storyId: string
  storyTitle: string
  storyIndex?: number
  storyChat?: { ctx: ChatContext; label: string; key: string; updatedAt: string }
  topics: { ctx: ChatContext; label: string; key: string; updatedAt: string }[]
  runs: { ctx: ChatContext; label: string; key: string; updatedAt: string }[]
  features: Record<
    string,
    {
      featureId: string
      featureTitle: string
      featureChat?: { ctx: ChatContext; label: string; key: string; updatedAt: string }
      runs: { ctx: ChatContext; label: string; key: string; updatedAt: string }[]
      updatedAt: string
    }
  >
  updatedAt: string
}

function storageKey(projectId?: string, mode?: 'categories' | 'history') {
  return `chat-nav-open:${projectId || 'noproj'}:${mode || 'categories'}`
}

function computeKeysForContext(ctx: ChatContext): string[] {
  const keys: string[] = []
  const storiesKey = 'cat:stories'
  const topicsKey = 'cat:project-topics'

  if (ctx.type === 'PROJECT') {
    return keys
  }

  if (
    ctx.type === 'STORY' ||
    ctx.type === 'FEATURE' ||
    ctx.type === 'STORY_TOPIC' ||
    ctx.type === 'AGENT_RUN' ||
    ctx.type === 'AGENT_RUN_FEATURE'
  ) {
    const sid = (ctx as any).storyId as string
    keys.push(storiesKey)
    keys.push(`story:${sid}`)
    if (ctx.type === 'STORY_TOPIC') keys.push(`story:${sid}:topics`)
    if (ctx.type === 'AGENT_RUN') keys.push(`story:${sid}:runs`)
    if (ctx.type === 'FEATURE' || ctx.type === 'AGENT_RUN_FEATURE') {
      keys.push(`story:${sid}:features`)
      const fid = (ctx as any).featureId as string
      keys.push(`feature:${fid}`)
      if (ctx.type === 'AGENT_RUN_FEATURE') keys.push(`feature:${fid}:runs`)
    }
  }
  if (ctx.type === 'PROJECT_TOPIC') keys.push(topicsKey)
  return keys
}

// Extracted, stable components
const SectionHeader = memo(function SectionHeader({
  title,
  openKey,
  className,
  isOpen,
  onToggle,
}: {
  title: string
  openKey?: string
  className?: string
  isOpen: boolean
  onToggle: (key: string) => void
}) {
  return (
    <button
      type="button"
      className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]/90 border-b border-[var(--border-subtle)] ${className ?? ''}`}
      onClick={() => openKey && onToggle(openKey)}
      aria-expanded={isOpen}
      aria-controls={openKey ? `${openKey}-section` : undefined}
    >
      {openKey && (
        <span className="flex-none">
          <IconChevron
            className="w-4 h-4"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </span>
      )}
      <span className="font-semibold">{title}</span>
    </button>
  )
})

const ChatButton = memo(function ChatButton({
  ctx,
  label,
  isActive,
  onClick,
  unreadCount,
  isThinking,
  updatedAt,
}: {
  ctx: ChatContext
  label: string
  isActive: boolean
  onClick: (ctx: ChatContext) => void
  unreadCount: number
  isThinking: boolean
  updatedAt?: string
}) {
  const cap99 = (n: number) => (n > 99 ? '99+' : `${n}`)
  const hasUnread = unreadCount > 0

  return (
    <button
      className={[
        'w-full text-left rounded-md px-3 py-2 border shadow-sm transition-colors',
        isActive
          ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
      ].join(' ')}
      onClick={() => onClick(ctx)}
      title={label}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{label}</div>
        {isThinking ? (
          <SpinnerWithDot
            size={14}
            showDot={hasUnread}
            dotTitle={hasUnread ? 'Unread messages' : undefined}
          />
        ) : hasUnread ? (
          <NotificationBadge
            className={'h-[16px] min-w-[16px] px-1 text-[10px]'}
            text={cap99(unreadCount)}
            tooltipLabel={`${unreadCount} unread messages`}
          />
        ) : null}
      </div>
      {updatedAt && (
        <div className="text-[10px] text-[var(--text-tertiary)] truncate">Updated {updatedAt}</div>
      )}
    </button>
  )
})

// Wrapper to connect ChatButton to live data
const ConnectedChatButton = memo(function ConnectedChatButton({
  ctx,
  label,
  isActive,
  onClick,
  updatedAt,
}: {
  ctx: ChatContext
  label: string
  isActive: boolean
  onClick: (ctx: ChatContext) => void
  updatedAt?: string
}) {
  const { unreadKeys, getUnreadCountForKey } = useChatUnread()
  const { isThinkingKey } = useChatThinking(500)

  const key = useMemo(() => getChatContextPath(ctx), [ctx])
  const isUnread = unreadKeys.has(key)
  const unreadCount = isUnread ? getUnreadCountForKey(key) : 0
  const isThinking = isThinkingKey(key)

  return (
    <ChatButton
      ctx={ctx}
      label={label}
      isActive={isActive}
      onClick={onClick}
      unreadCount={unreadCount}
      isThinking={isThinking}
      updatedAt={updatedAt}
    />
  )
})

const StoryHeaderButton = memo(function StoryHeaderButton({
  storyId,
  storyTitle,
  storyIndex,
  openKey,
  isOpen,
  onToggle,
}: {
  storyId: string
  storyTitle: string
  storyIndex?: number
  openKey: string
  isOpen: boolean
  onToggle: (key: string) => void
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-between rounded-md border bg-[var(--surface-raised)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
      onClick={() => onToggle(openKey)}
      aria-expanded={isOpen}
      aria-controls={`${openKey}-section`}
      title={storyTitle}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex-none">
          <IconChevron
            className="w-4 h-4"
            style={{
              transform: isOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </span>
        <span className="truncate">{storyTitle}</span>
      </div>
      {typeof storyIndex === 'number' && <span className="ml-2 id-chip">{storyIndex}</span>}
    </button>
  )
})

export default function ChatsNavigationSidebar({
  selectedContext,
  onSelectContext,
  mode,
}: ChatsNavigationSidebarProps) {
  const { projectId: activeProjectId, project } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { chatsByProjectId } = useChats()

  const getProjectTitle = useCallback(
    (id?: string) => {
      if (!id) return ''
      const p = projects.find((prj) => prj.id === id)
      return p?.title || id
    },
    [projects],
  )

  const getStoryTitle = useCallback(
    (id?: string) => {
      if (!id) return ''
      const s = storiesById[id]
      return s?.title || 'Deleted story'
    },
    [storiesById],
  )

  const getFeatureTitle = useCallback(
    (id?: string) => {
      if (!id) return ''
      const f = featuresById[id]
      return f?.title || 'Deleted feature'
    },
    [featuresById],
  )

  // Enforce active project scoping for all chat lists
  const projectChats = useMemo(() => {
    const raw = chatsByProjectId[activeProjectId] || []
    const filtered = raw.filter((c) => {
      const ctx = c.chat.context as any
      const type = ctx?.type
      if (
        type === 'PROJECT' ||
        type === 'PROJECT_TOPIC' ||
        type === 'AGENT_RUN' ||
        type === 'AGENT_RUN_FEATURE'
      ) {
        return ctx.projectId === activeProjectId
      }
      if (type === 'STORY' || type === 'FEATURE' || type === 'STORY_TOPIC') {
        const sid: string | undefined = ctx.storyId
        if (!sid) return false
        return !!project?.storyIdToDisplayIndex?.[sid]
      }
      return false
    })
    return filtered.slice()
  }, [chatsByProjectId, activeProjectId, project])

  // Hash of timestamps for the active project's chats to trigger re-sorting when they change
  const chatsTimeHash = useMemo(() => {
    const list = chatsByProjectId[activeProjectId] || []
    return list.map((c) => `${c.key}:${c.chat.updatedAt || c.chat.createdAt || ''}`).join('|')
  }, [chatsByProjectId, activeProjectId])

  const sortedByUpdated = useMemo(() => {
    const arr = projectChats.slice()
    arr.sort((a, b) => {
      const au = a.chat.updatedAt || a.chat.createdAt || ''
      const bu = b.chat.updatedAt || b.chat.createdAt || ''
      return bu.localeCompare(au)
    })
    return arr
  }, [projectChats, chatsTimeHash])

  const [open, setOpen] = useState<OpenState>(() => {
    try {
      const raw = localStorage.getItem(storageKey(activeProjectId, mode))
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    setOpen(() => {
      try {
        const raw = localStorage.getItem(storageKey(activeProjectId, mode))
        return raw ? JSON.parse(raw) : {}
      } catch {
        return {}
      }
    })
  }, [activeProjectId, mode])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(activeProjectId, mode), JSON.stringify(open))
    } catch (e) {
      console.error('Failed to save chat nav state', e)
    }
  }, [open, activeProjectId, mode])

  useEffect(() => {
    if (!selectedContext) return

    const keys = computeKeysForContext(selectedContext)
    if (keys.length > 0) {
      setOpen((prev) => {
        const next = { ...prev }
        let hasChanged = false
        for (const key of keys) {
          if (!next[key]) {
            next[key] = true
            hasChanged = true
          }
        }
        return hasChanged ? next : prev
      })
    }
  }, [selectedContext])

  const isActive = useCallback(
    (ctx: ChatContext) => {
      if (!selectedContext) return false
      return getChatContextPath(selectedContext) === getChatContextPath(ctx)
    },
    [selectedContext],
  )

  const ensureOpen = useCallback(
    (ctx: ChatContext) => {
      // Do not prefetch/create chats here to avoid accidentally recreating deleted chats
      onSelectContext(ctx)
    },
    [onSelectContext],
  )

  const handleToggle = useCallback((key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const generalContext: ChatContext = useMemo(
    () => ({ type: 'PROJECT', projectId: activeProjectId }),
    [activeProjectId],
  )

  const storiesGrouping = useMemo(() => {
    const byStory = new Map<string, StoryGroup>()

    for (const c of projectChats) {
      const ctx = c.chat.context
      const updatedAt = c.chat.updatedAt || c.chat.createdAt || ''
      const type = ctx.type

      if (
        type === 'STORY' ||
        type === 'FEATURE' ||
        type === 'STORY_TOPIC' ||
        type === 'AGENT_RUN' ||
        type === 'AGENT_RUN_FEATURE'
      ) {
        const sid = (ctx as any).storyId as string | undefined
        if (!sid) continue
        const storyTitle = getStoryTitle(sid)
        const storyIndex = project?.storyIdToDisplayIndex?.[sid]
        let group = byStory.get(sid)
        if (!group) {
          group = {
            storyId: sid,
            storyTitle,
            storyIndex,
            storyChat: undefined,
            topics: [],
            runs: [],
            features: {},
            updatedAt: updatedAt,
          }
          byStory.set(sid, group)
        }
        group.updatedAt = group.updatedAt.localeCompare(updatedAt) < 0 ? updatedAt : group.updatedAt

        if (type === 'STORY') {
          const label = titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle })
          group.storyChat = { ctx, label, key: c.key, updatedAt }
        } else if (type === 'STORY_TOPIC') {
          const label = titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle })
          group.topics.push({ ctx, label, key: c.key, updatedAt })
        } else if (type === 'AGENT_RUN') {
          const label = titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle })
          group.runs.push({ ctx, label, key: c.key, updatedAt })
        } else if (type === 'FEATURE' || type === 'AGENT_RUN_FEATURE') {
          const fid = (ctx as any).featureId as string | undefined
          if (!fid) continue
          const ftitle = getFeatureTitle(fid)
          let f = group.features[fid]
          if (!f) {
            f = {
              featureId: fid,
              featureTitle: ftitle,
              featureChat: undefined,
              runs: [],
              updatedAt,
            }
            group.features[fid] = f
          }
          f.updatedAt = f.updatedAt.localeCompare(updatedAt) < 0 ? updatedAt : f.updatedAt
          const label = titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle })
          if (type === 'FEATURE') f.featureChat = { ctx, label, key: c.key, updatedAt }
          else f.runs.push({ ctx, label, key: c.key, updatedAt })
        }
      }
    }

    const groups = Array.from(byStory.values()).map((g) => ({
      ...g,
      topics: g.topics.sort((a, b) => a.label.localeCompare(b.label)),
      runs: g.runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      features: Object.fromEntries(
        Object.entries(g.features)
          .sort(([, a], [, b]) => a.featureTitle.localeCompare(b.featureTitle))
          .map(([fid, f]) => [
            fid,
            { ...f, runs: f.runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) },
          ]),
      ),
    }))

    groups.sort((a, b) => a.storyTitle.localeCompare(b.storyTitle))
    return groups
  }, [projectChats, getProjectTitle, getStoryTitle, getFeatureTitle, project])

  const projectTopics = useMemo(() => {
    type TopicItem = { ctx: ChatContext; label: string; key: string; updatedAt: string }
    const items: TopicItem[] = []
    for (const c of projectChats) {
      const ctx = c.chat.context
      const updatedAt = c.chat.updatedAt || c.chat.createdAt || ''
      if (ctx.type === 'PROJECT_TOPIC') {
        items.push({
          ctx,
          label: titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle }),
          key: c.key,
          updatedAt,
        })
      }
    }
    items.sort((a, b) => a.label.localeCompare(b.label))
    return items
  }, [projectChats, getProjectTitle, getStoryTitle, getFeatureTitle])

  return (
    <div className="flex-1 min-h-0 overflow-auto px-2 pb-3 space-y-3">
      {mode === 'categories' ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader
                title="General"
                isOpen={true}
                onToggle={handleToggle}
              />
            </div>
            <div className="px-2">
              <ConnectedChatButton
                ctx={generalContext}
                label={titleForContext(generalContext, {
                  getProjectTitle,
                  getStoryTitle,
                  getFeatureTitle,
                })}
                isActive={isActive(generalContext)}
                onClick={ensureOpen}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader
                title="Stories"
                openKey="cat:stories"
                isOpen={!!open['cat:stories']}
                onToggle={handleToggle}
              />
            </div>
            {open['cat:stories'] && (
              <div id="cat:stories-section" className="space-y-2">
                {storiesGrouping.length === 0 ? (
                  <div className="text-[13px] text-[var(--text-secondary)] px-2 py-1">
                    No story-related chats yet.
                  </div>
                ) : (
                  storiesGrouping.map((g) => {
                    const skey = `story:${g.storyId}`
                    const isOpen = !!open[skey]
                    return (
                      <div key={g.storyId} className="space-y-1">
                        <div className="px-2">
                          <StoryHeaderButton
                            storyId={g.storyId}
                            storyTitle={g.storyTitle}
                            storyIndex={g.storyIndex}
                            openKey={skey}
                            isOpen={isOpen}
                            onToggle={handleToggle}
                          />
                        </div>
                        {isOpen && (
                          <div id={`${skey}-section`} className="pl-4 space-y-2">
                            {g.storyChat && (
                              <div className="border-l border-[var(--border-subtle)]">
                                <div className="pl-2">
                                  <ConnectedChatButton
                                    ctx={g.storyChat.ctx}
                                    label={g.storyChat.label}
                                    isActive={isActive(g.storyChat.ctx)}
                                    onClick={ensureOpen}
                                  />
                                </div>
                              </div>
                            )}

                            {g.topics.length > 0 && (
                              <div className="space-y-1">
                                <SectionHeader
                                  title="Topics"
                                  openKey={`story:${g.storyId}:topics`}
                                  isOpen={!!open[`story:${g.storyId}:topics`]}
                                  onToggle={handleToggle}
                                />
                                {open[`story:${g.storyId}:topics`] && (
                                  <div
                                    id={`story:${g.storyId}:topics-section`}
                                    className="pl-4 space-y-1"
                                  >
                                    <div className="border-l border-[var(--border-subtle)]">
                                      {g.topics.map((it) => (
                                        <div key={it.key} className="pl-2">
                                          <ConnectedChatButton
                                            ctx={it.ctx}
                                            label={it.label}
                                            isActive={isActive(it.ctx)}
                                            onClick={ensureOpen}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {g.runs.length > 0 && (
                              <div className="space-y-1">
                                <SectionHeader
                                  title="Agent Runs"
                                  openKey={`story:${g.storyId}:runs`}
                                  isOpen={!!open[`story:${g.storyId}:runs`]}
                                  onToggle={handleToggle}
                                />
                                {open[`story:${g.storyId}:runs`] && (
                                  <div
                                    id={`story:${g.storyId}:runs-section`}
                                    className="pl-4 space-y-1"
                                  >
                                    <div className="border-l border-[var(--border-subtle)]">
                                      {g.runs.map((it) => (
                                        <div key={it.key} className="pl-2">
                                          <ConnectedChatButton
                                            ctx={it.ctx}
                                            label={it.label}
                                            isActive={isActive(it.ctx)}
                                            onClick={ensureOpen}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {Object.keys(g.features).length > 0 && (
                              <div className="space-y-1">
                                <SectionHeader
                                  title="Features"
                                  openKey={`story:${g.storyId}:features`}
                                  isOpen={!!open[`story:${g.storyId}:features`]}
                                  onToggle={handleToggle}
                                />
                                {open[`story:${g.storyId}:features`] && (
                                  <div
                                    id={`story:${g.storyId}:features-section`}
                                    className="pl-4 space-y-2"
                                  >
                                    {Object.values(g.features).map((f) => {
                                      const fkey = `feature:${f.featureId}`
                                      const fOpen = !!open[fkey]
                                      return (
                                        <div key={f.featureId} className="space-y-1">
                                          <button
                                            type="button"
                                            className="w-full flex items-center gap-2 rounded-md border bg-[var(--surface-overlay)] px-3 py-2 text-left text-[12px] font-medium text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                                            onClick={() => handleToggle(fkey)}
                                            aria-expanded={fOpen}
                                            aria-controls={`${fkey}-section`}
                                            title={f.featureTitle}
                                          >
                                            <span className="flex-none">
                                              <IconChevron
                                                className="w-4 h-4"
                                                style={{
                                                  transform: fOpen ? 'rotate(90deg)' : 'none',
                                                  transition: 'transform 0.15s ease',
                                                }}
                                              />
                                            </span>
                                            <span className="truncate">{f.featureTitle}</span>
                                          </button>
                                          {fOpen && (
                                            <div id={`${fkey}-section`} className="pl-4 space-y-1">
                                              {f.featureChat && (
                                                <div className="border-l border-[var(--border-subtle)]">
                                                  <div className="pl-2">
                                                    <ConnectedChatButton
                                                      ctx={f.featureChat.ctx}
                                                      label={f.featureChat.label}
                                                      isActive={isActive(f.featureChat.ctx)}
                                                      onClick={ensureOpen}
                                                    />
                                                  </div>
                                                </div>
                                              )}
                                              {f.runs.length > 0 && (
                                                <div className="space-y-1">
                                                  <SectionHeader
                                                    title="Agents"
                                                    openKey={`feature:${f.featureId}:runs`}
                                                    isOpen={!!open[`feature:${f.featureId}:runs`]}
                                                    onToggle={handleToggle}
                                                  />
                                                  {open[`feature:${f.featureId}:runs`] && (
                                                    <div
                                                      id={`feature:${f.featureId}:runs-section`}
                                                      className="pl-4 space-y-1"
                                                    >
                                                      <div className="border-l border-[var(--border-subtle)]">
                                                        {f.runs.map((it) => (
                                                          <div key={it.key} className="pl-2">
                                                            <ConnectedChatButton
                                                              ctx={it.ctx}
                                                              label={it.label}
                                                              isActive={isActive(it.ctx)}
                                                              onClick={ensureOpen}
                                                            />
                                                          </div>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader
                title="Project Topics"
                openKey="cat:project-topics"
                isOpen={!!open['cat:project-topics']}
                onToggle={handleToggle}
              />
            </div>
            {open['cat:project-topics'] && (
              <div id="cat:project-topics-section" className="pl-4 space-y-1">
                {projectTopics.length === 0 ? (
                  <div className="text-[13px] text-[var(--text-secondary)] px-0 py-1">
                    No project topic chats.
                  </div>
                ) : (
                  <div className="border-l border-[var(--border-subtle)]">
                    {projectTopics.map((t) => (
                      <div key={t.key} className="pl-2">
                        <ConnectedChatButton
                          ctx={t.ctx}
                          label={t.label}
                          isActive={isActive(t.ctx)}
                          onClick={ensureOpen}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]/90 border-b border-[var(--border-subtle)]">
            History
          </div>
          {sortedByUpdated.length === 0 ? (
            <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
              No chats yet for this project.
            </div>
          ) : (
            <div className="space-y-1">
              {sortedByUpdated.map((c) => {
                const ctx = c.chat.context
                const label = titleForContext(ctx, {
                  getProjectTitle,
                  getStoryTitle,
                  getFeatureTitle,
                })
                return (
                  <ConnectedChatButton
                    key={c.key}
                    ctx={ctx}
                    label={label}
                    isActive={isActive(ctx)}
                    onClick={onSelectContext}
                    updatedAt={c.chat.updatedAt || c.chat.createdAt || ''}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
