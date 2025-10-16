import React, { useEffect, useMemo, useState, useCallback } from 'react'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { useActiveProject, useProjectContext } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-tools'

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

  const isActive = useCallback(
    (ctx: ChatContext) => {
      if (!selectedContext) return false
      // Cheap structural comparison
      return JSON.stringify(selectedContext) === JSON.stringify(ctx)
    },
    [selectedContext],
  )

  const ensureOpen = async (ctx: ChatContext) => {
    try {
      await getChat(ctx) // ensures it exists; does not clear existing
    } catch (e) {
      // ignore; selection will still proceed
    }
    onSelectContext(ctx)
  }

  const generalContext: ChatContext = useMemo(
    () => ({ type: 'PROJECT', projectId: activeProjectId }),
    [activeProjectId],
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
        <div className="space-y-2">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)]/90 border-b border-[var(--border-subtle)]">
            General
          </div>
          <div className="space-y-1">
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
