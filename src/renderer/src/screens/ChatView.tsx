import React, { useEffect, useMemo, useState } from 'react'
import { ChatSidebar } from '@renderer/components/chat'
import { useProjectContext, useActiveProject } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import type {
  ChatContext,
  ChatContextAgentRun,
  ChatContextFeature,
  ChatContextProject,
  ChatContextProjectTopic,
  ChatContextStory,
  ChatContextStoryTopic,
} from 'thefactory-tools'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import { IconPlus } from '../components/ui/Icons'

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
      return `Project Chat — ${opts.getProjectTitle((context as ChatContextProject).projectId)}`
    case 'STORY':
      return `Story Chat — ${opts.getStoryTitle((context as ChatContextStory).storyId)}`
    case 'FEATURE': {
      const c = context as ChatContextFeature
      return `Feature Chat — ${opts.getStoryTitle(c.storyId)} / ${opts.getFeatureTitle(c.featureId)}`
    }
    case 'PROJECT_TOPIC': {
      const c = context as ChatContextProjectTopic
      return `Project ${prettyTopicName(c.projectTopic)} — ${opts.getProjectTitle(c.projectId)}`
    }
    case 'STORY_TOPIC': {
      const c = context as ChatContextStoryTopic
      return `Story ${prettyTopicName(c.storyTopic)} — ${opts.getStoryTitle(c.storyId)}`
    }
    case 'AGENT_RUN':
      return `Agent Run Chat — ${(context as ChatContextAgentRun).agentRunId || ''}`
    default:
      return 'Chat'
  }
}

export default function ChatView() {
  const { projectId: activeProjectId } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { chats, chatsByProjectId, restartChat } = useChats()

  // Helpers for titles
  const getProjectTitle = (id?: string) => {
    if (!id) return ''
    const p = projects.find((prj) => prj.id === id)
    return p?.title || id
  }
  const getStoryTitle = (id?: string) => (id ? storiesById[id]?.title || id : '')
  const getFeatureTitle = (id?: string) => (id ? featuresById[id]?.title || id : '')

  // Flatten all chats across all projects
  const allChatStates = useMemo(() => Object.values(chats || {}), [chats])

  // Sorting helper by updatedAt desc then createdAt desc
  function sortByUpdated<T extends { chat: { updatedAt?: string; createdAt?: string } }>(arr: T[]) {
    return [...arr].sort((a, b) => {
      const au = a.chat.updatedAt || a.chat.createdAt || ''
      const bu = b.chat.updatedAt || b.chat.createdAt || ''
      return bu.localeCompare(au)
    })
  }

  // GENERAL: aggregate project chats across all projects
  const generalChats = useMemo(() => {
    const list = allChatStates.filter((s) => s.chat.context.type === 'PROJECT')
    return sortByUpdated(list)
  }, [allChatStates])

  // STORIES and FEATURES for the active project
  const storyChats = useMemo(() => {
    const list = (chatsByProjectId[activeProjectId] || []).filter(
      (s) => s.chat.context.type === 'STORY',
    )
    return sortByUpdated(list)
  }, [chatsByProjectId, activeProjectId])

  const featureChats = useMemo(() => {
    const list = (chatsByProjectId[activeProjectId] || []).filter(
      (s) => s.chat.context.type === 'FEATURE',
    )
    return sortByUpdated(list)
  }, [chatsByProjectId, activeProjectId])

  // TOPICS for the active project
  const projectTopicChats = useMemo(() => {
    const list = (chatsByProjectId[activeProjectId] || []).filter(
      (s) => s.chat.context.type === 'PROJECT_TOPIC',
    )
    return sortByUpdated(list)
  }, [chatsByProjectId, activeProjectId])

  const storyTopicChats = useMemo(() => {
    const list = (chatsByProjectId[activeProjectId] || []).filter(
      (s) => s.chat.context.type === 'STORY_TOPIC',
    )
    return sortByUpdated(list)
  }, [chatsByProjectId, activeProjectId])

  // Group topic chats by topic name
  const projectTopicsGrouped = useMemo(() => {
    const byTopic: Record<string, typeof projectTopicChats> = {}
    for (const s of projectTopicChats) {
      const topic = (s.chat.context as ChatContextProjectTopic).projectTopic || 'general'
      if (!byTopic[topic]) byTopic[topic] = []
      byTopic[topic].push(s)
    }
    for (const k of Object.keys(byTopic)) byTopic[k] = sortByUpdated(byTopic[k])
    const entries = Object.entries(byTopic).sort((a, b) => {
      const au = a[1][0]?.chat.updatedAt || a[1][0]?.chat.createdAt || ''
      const bu = b[1][0]?.chat.updatedAt || b[1][0]?.chat.createdAt || ''
      return bu.localeCompare(au)
    })
    return entries
  }, [projectTopicChats])

  const storyTopicsGrouped = useMemo(() => {
    const byTopic: Record<string, typeof storyTopicChats> = {}
    for (const s of storyTopicChats) {
      const topic = (s.chat.context as ChatContextStoryTopic).storyTopic || 'general'
      if (!byTopic[topic]) byTopic[topic] = []
      byTopic[topic].push(s)
    }
    for (const k of Object.keys(byTopic)) byTopic[k] = sortByUpdated(byTopic[k])
    const entries = Object.entries(byTopic).sort((a, b) => {
      const au = a[1][0]?.chat.updatedAt || a[1][0]?.chat.createdAt || ''
      const bu = b[1][0]?.chat.updatedAt || b[1][0]?.chat.createdAt || ''
      return bu.localeCompare(au)
    })
    return entries
  }, [storyTopicChats])

  // Selected context state
  const [selectedContext, setSelectedContext] = useState<ChatContext | undefined>(undefined)
  useEffect(() => {
    // choose the first available chat across sections if none selected yet
    let first: ChatContext | undefined
    first = generalChats[0]?.chat.context
    if (!first) first = storyChats[0]?.chat.context
    if (!first) first = featureChats[0]?.chat.context
    if (!first) first = projectTopicChats[0]?.chat.context
    if (!first) first = storyTopicChats[0]?.chat.context

    setSelectedContext((prev) => prev || first)
  }, [generalChats, storyChats, featureChats, projectTopicChats, storyTopicChats])

  const handleNewChat = async () => {
    // New General chat: restart the PROJECT chat for current active project
    const context: ChatContext = { type: 'PROJECT', projectId: activeProjectId }
    await restartChat(context)
    setSelectedContext(context)
  }

  // Collapsible sections state
  const [isGeneralOpen, setGeneralOpen] = useState(true)
  const [isStoriesOpen, setStoriesOpen] = useState(true)
  const [isFeaturesOpen, setFeaturesOpen] = useState(true)
  const [isTopicsOpen, setTopicsOpen] = useState(true)

  const renderChatButton = (ctx: ChatContext, key: string) => {
    const isActive = selectedContext && JSON.stringify(selectedContext) === JSON.stringify(ctx)
    const label = titleForContext(ctx, {
      getProjectTitle,
      getStoryTitle,
      getFeatureTitle,
    })
    return (
      <button
        key={key}
        className={[
          'w-full text-left rounded-md px-3 py-2 border',
          isActive
            ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
            : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
        ].join(' ')}
        onClick={() => setSelectedContext(ctx)}
        title={label}
      >
        <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{label}</div>
      </button>
    )
  }

  const navContent = (
    <div className="flex-1 min-h-0 overflow-auto px-2 pb-3 space-y-2">
      {/* GENERAL */}
      <div>
        <button
          className="w-full flex items-center justify-between text-left px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]"
          onClick={() => setGeneralOpen((v) => !v)}
        >
          <span>GENERAL</span>
          <span>{isGeneralOpen ? '−' : '+'}</span>
        </button>
        {isGeneralOpen && (
          <div className="space-y-1">
            {generalChats.length === 0 ? (
              <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
                No general chats yet.
              </div>
            ) : (
              generalChats.map((c) => renderChatButton(c.chat.context, c.key))
            )}
          </div>
        )}
      </div>

      {/* STORIES (with nested FEATURES) */}
      <div className="space-y-2">
        <div>
          <button
            className="w-full flex items-center justify-between text-left px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]"
            onClick={() => setStoriesOpen((v) => !v)}
          >
            <span>STORIES</span>
            <span>{isStoriesOpen ? '−' : '+'}</span>
          </button>
          {isStoriesOpen && (
            <div className="space-y-1">
              {storyChats.length === 0 ? (
                <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
                  No story chats yet.
                </div>
              ) : (
                storyChats.map((c) => renderChatButton(c.chat.context, c.key))
              )}
            </div>
          )}
        </div>

        <div>
          <button
            className="w-full flex items-center justify-between text-left px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]"
            onClick={() => setFeaturesOpen((v) => !v)}
          >
            <span>FEATURES</span>
            <span>{isFeaturesOpen ? '−' : '+'}</span>
          </button>
          {isFeaturesOpen && (
            <div className="space-y-1">
              {featureChats.length === 0 ? (
                <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
                  No feature chats yet.
                </div>
              ) : (
                featureChats.map((c) => renderChatButton(c.chat.context, c.key))
              )}
            </div>
          )}
        </div>
      </div>

      {/* TOPICS */}
      <div className="space-y-2">
        <div>
          <button
            className="w-full flex items-center justify-between text-left px-2 py-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]"
            onClick={() => setTopicsOpen((v) => !v)}
          >
            <span>TOPICS</span>
            <span>{isTopicsOpen ? '−' : '+'}</span>
          </button>
          {isTopicsOpen && (
            <div className="space-y-2">
              {/* Project Topics */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] px-2 py-1">
                  Project Topics
                </div>
                <div className="space-y-2">
                  {projectTopicsGrouped.length === 0 ? (
                    <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
                      No project topic chats yet.
                    </div>
                  ) : (
                    projectTopicsGrouped.map(([topic, items]) => (
                      <div key={topic} className="pl-1">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] px-2 py-1">
                          {prettyTopicName(topic)}
                        </div>
                        <div className="space-y-1">
                          {items.map((c) => renderChatButton(c.chat.context, c.key))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Story Topics */}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] px-2 py-1">
                  Story Topics
                </div>
                <div className="space-y-2">
                  {storyTopicsGrouped.length === 0 ? (
                    <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
                      No story topic chats yet.
                    </div>
                  ) : (
                    storyTopicsGrouped.map(([topic, items]) => (
                      <div key={topic} className="pl-1">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] px-2 py-1">
                          {prettyTopicName(topic)}
                        </div>
                        <div className="space-y-1">
                          {items.map((c) => renderChatButton(c.chat.context, c.key))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <CollapsibleSidebar
      items={[]}
      activeId={''}
      onSelect={() => {}}
      storageKey="chatview-sidebar-collapsed"
      headerTitle=""
      headerSubtitle=""
      headerAction={
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Create chat"
          onClick={handleNewChat}
          title="Create chat"
        >
          <IconPlus className="w-4 h-4" />
        </button>
      }
      navContent={navContent}
    >
      {selectedContext ? (
        <ChatSidebar
          context={selectedContext}
          chatContextTitle={titleForContext(selectedContext, {
            getProjectTitle,
            getStoryTitle,
            getFeatureTitle,
          })}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[var(--text-secondary)]">
          Select a chat to begin.
        </div>
      )}
    </CollapsibleSidebar>
  )
}
