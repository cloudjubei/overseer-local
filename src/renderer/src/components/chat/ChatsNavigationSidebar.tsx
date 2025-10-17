import React, { useEffect, useMemo, useState, useCallback } from 'react'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { useActiveProject, useProjectContext } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-tools'
import { IconChevron } from '@renderer/components/ui/icons/Icons'

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
      return `Feature Chat — ${opts.getStoryTitle(context.storyId)} / ${opts.getFeatureTitle(context.featureId)}`
    case 'PROJECT_TOPIC':
      return `Project ${prettyTopicName((context as any).projectTopic)} — ${opts.getProjectTitle(context.projectId)}`
    case 'STORY_TOPIC':
      return `Story ${prettyTopicName((context as any).storyTopic)} — ${opts.getStoryTitle(context.storyId)}`
    case 'AGENT_RUN':
      return `Agent Story Run — ${opts.getStoryTitle(context.storyId)}`
    case 'AGENT_RUN_FEATURE':
      return `Agent Feature Run — ${opts.getStoryTitle(context.storyId)} / ${opts.getFeatureTitle(context.featureId)}`
    default:
      return 'Chat'
  }
}

export type ChatsNavigationSidebarProps = {
  selectedContext?: ChatContext
  onSelectContext: (ctx: ChatContext) => void
}

type OpenState = Record<string, boolean>

export default function ChatsNavigationSidebar({
  selectedContext,
  onSelectContext,
}: ChatsNavigationSidebarProps) {
  const { projectId: activeProjectId } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { chatsByProjectId, getChat } = useChats()

  const getProjectTitle = (id?: string) => {
    if (!id) return ''
    const p = projects.find((prj) => prj.id === id)
    return p?.title || id
  }
  const getStoryTitle = (id?: string) => (id ? storiesById[id]?.title || id : '')
  const getFeatureTitle = (id?: string) => (id ? featuresById[id]?.title || id : '')

  const [mode, setMode] = useState<'categories' | 'history'>(() => {
    const saved = localStorage.getItem('chat-sidebar-mode')
    return saved === 'history' ? 'history' : 'categories'
  })
  useEffect(() => {
    localStorage.setItem('chat-sidebar-mode', mode)
  }, [mode])

  const projectChats = useMemo(() => {
    return (chatsByProjectId[activeProjectId] || []).slice()
  }, [chatsByProjectId, activeProjectId])

  const sortedByUpdated = useMemo(() => {
    return projectChats.sort((a, b) => {
      const au = a.chat.updatedAt || a.chat.createdAt || ''
      const bu = b.chat.updatedAt || b.chat.createdAt || ''
      return bu.localeCompare(au)
    })
  }, [projectChats])

  // Category open state: top-level and per story
  const [open, setOpen] = useState<OpenState>({})

  const isActive = useCallback(
    (ctx: ChatContext) => {
      if (!selectedContext) return false
      return JSON.stringify(selectedContext) === JSON.stringify(ctx)
    },
    [selectedContext],
  )

  const ensureOpen = async (ctx: ChatContext) => {
    try {
      await getChat(ctx) // ensures it exists; does not clear existing
    } catch (_) {}
    onSelectContext(ctx)
    // When selecting a chat, collapse all and only open the relevant sections
    const next: OpenState = {}
    const catAndStory = computeKeysForContext(ctx)
    catAndStory.forEach((k) => (next[k] = true))
    setOpen(next)
  }

  const generalContext: ChatContext = useMemo(
    () => ({ type: 'PROJECT', projectId: activeProjectId }),
    [activeProjectId],
  )

  // Compute grouping for categories view
  const storiesGrouping = useMemo(() => {
    type StoryGroup = {
      storyId: string
      storyTitle: string
      items: { ctx: ChatContext; label: string; type: string; key: string; updatedAt: string }[]
    }
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
        const group = byStory.get(sid) || {
          storyId: sid,
          storyTitle: getStoryTitle(sid),
          items: [],
        }
        const label = titleForContext(ctx, { getProjectTitle, getStoryTitle, getFeatureTitle })
        group.items.push({ ctx, label, type, key: c.key, updatedAt })
        byStory.set(sid, group)
      }
    }
    // sort items inside a story group by updated desc
    const groups = Array.from(byStory.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }))
    // sort groups by story title
    groups.sort((a, b) => a.storyTitle.localeCompare(b.storyTitle))
    return groups
  }, [projectChats, getProjectTitle, getStoryTitle, getFeatureTitle])

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

  // When selectedContext changes (from deep link or restore), open only the relevant sections
  useEffect(() => {
    if (!selectedContext) return
    const next: OpenState = {}
    const keys = computeKeysForContext(selectedContext)
    keys.forEach((k) => (next[k] = true))
    setOpen(next)
  }, [selectedContext])

  function computeKeysForContext(ctx: ChatContext): string[] {
    const keys: string[] = []
    // Open corresponding top-level category and subcategory keys
    if (ctx.type === 'PROJECT') {
      // nothing collapsible for General
      return keys
    }
    // Stories cat key
    const storiesKey = 'cat:stories'
    // Topics cat key
    const topicsKey = 'cat:project-topics'

    if (
      ctx.type === 'STORY' ||
      ctx.type === 'FEATURE' ||
      ctx.type === 'STORY_TOPIC' ||
      ctx.type === 'AGENT_RUN' ||
      ctx.type === 'AGENT_RUN_FEATURE'
    ) {
      keys.push(storiesKey)
      if ((ctx as any).storyId) keys.push(`story:${(ctx as any).storyId}`)
    }
    if (ctx.type === 'PROJECT_TOPIC') {
      keys.push(topicsKey)
    }
    return keys
  }

  const SectionHeader: React.FC<{
    title: string
    openKey?: string
    defaultOpen?: boolean
  }> = ({ title, openKey, defaultOpen }) => {
    const isOpen = openKey ? !!open[openKey] : true
    return (
      <button
        type="button"
        className="w-full flex items-center gap-2 px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]/90 border-b border-[var(--border-subtle)]"
        onClick={() => openKey && setOpen((prev) => ({ ...prev, [openKey]: !prev[openKey] }))}
        aria-expanded={isOpen}
        aria-controls={openKey ? `${openKey}-section` : undefined}
      >
        {openKey && (
          <IconChevron
            className="w-3 h-3"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}
          />
        )}
        <span className="font-semibold">{title}</span>
      </button>
    )
  }

  const TypePill: React.FC<{ type: string }> = ({ type }) => {
    const label =
      type === 'FEATURE'
        ? 'Feature'
        : type === 'STORY'
          ? 'Story'
          : type === 'AGENT_RUN' || type === 'AGENT_RUN_FEATURE'
            ? 'Run'
            : type === 'STORY_TOPIC'
              ? 'Topic'
              : ''
    if (!label) return null
    return (
      <span className="ml-2 inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
        {label}
      </span>
    )
  }

  const ChatButton: React.FC<{
    ctx: ChatContext
    label: string
  }> = ({ ctx, label }) => (
    <button
      className={[
        'w-full text-left rounded-md px-3 py-2 border shadow-sm transition-colors',
        isActive(ctx)
          ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
          : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
      ].join(' ')}
      onClick={() => ensureOpen(ctx)}
      title={label}
    >
      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{label}</div>
    </button>
  )

  return (
    <div className="flex-1 min-h-0 overflow-auto px-2 pb-3 space-y-3">
      <div className="px-2 pt-2">
        <SegmentedControl
          ariaLabel="Toggle chat list mode"
          options={[
            { value: 'categories', label: 'Categories' },
            { value: 'history', label: 'History' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'categories' | 'history')}
          size="sm"
        />
      </div>

      {mode === 'categories' ? (
        <div className="space-y-3">
          {/* General */}
          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader title="General" />
            </div>
            <div className="px-2">
              <button
                className={[
                  'w-full text-left rounded-md px-3 py-3 border shadow-sm transition-colors',
                  isActive(generalContext)
                    ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
                ].join(' ')}
                onClick={() => ensureOpen(generalContext)}
                title={titleForContext(generalContext, {
                  getProjectTitle,
                  getStoryTitle,
                  getFeatureTitle,
                })}
              >
                <div className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
                  {titleForContext(generalContext, {
                    getProjectTitle,
                    getStoryTitle,
                    getFeatureTitle,
                  })}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  Single chat for this project
                </div>
              </button>
            </div>
          </div>

          {/* Stories section */}
          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader title="Stories" openKey="cat:stories" />
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
                          <button
                            type="button"
                            className="w-full flex items-center justify-between rounded-md border bg-[var(--surface-raised)] px-3 py-2 text-left text-[12px] font-semibold text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                            onClick={() => setOpen((prev) => ({ ...prev, [skey]: !prev[skey] }))}
                            aria-expanded={isOpen}
                            aria-controls={`${skey}-section`}
                            title={g.storyTitle}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <IconChevron
                                className="w-3 h-3"
                                style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }}
                              />
                              <span className="truncate">{g.storyTitle}</span>
                            </div>
                          </button>
                        </div>
                        {isOpen && (
                          <div id={`${skey}-section`} className="pl-4 pr-2 space-y-1">
                            {g.items.map((it) => (
                              <div key={it.key} className="pl-2 border-l border-[var(--border-subtle)]">
                                <ChatButton ctx={it.ctx} label={it.label} />
                                <div className="px-2 pb-1">
                                  <TypePill type={it.type} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Project Topics */}
          <div className="space-y-1">
            <div className="px-2">
              <SectionHeader title="Project Topics" openKey="cat:project-topics" />
            </div>
            {open['cat:project-topics'] && (
              <div id="cat:project-topics-section" className="px-2 space-y-1">
                {projectTopics.length === 0 ? (
                  <div className="text-[13px] text-[var(--text-secondary)] px-0 py-1">
                    No project topic chats.
                  </div>
                ) : (
                  projectTopics.map((t) => (
                    <ChatButton key={t.key} ctx={t.ctx} label={t.label} />
                  ))
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
                  <button
                    key={c.key}
                    className={[
                      'w-full text-left rounded-md px-3 py-2 border shadow-sm transition-colors',
                      isActive(ctx)
                        ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
                    ].join(' ')}
                    onClick={() => onSelectContext(ctx)}
                    title={label}
                  >
                    <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{label}</div>
                    <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                      Updated {c.chat.updatedAt || c.chat.createdAt || ''}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
