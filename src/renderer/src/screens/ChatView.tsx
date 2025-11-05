import React, { useEffect, useState, useMemo } from 'react'
import { ChatSidebar } from '@renderer/components/chat'
import { useProjectContext, useActiveProject } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import { useAgents } from '@renderer/contexts/AgentsContext'
import type {
  ChatContext,
  ChatContextAgentRun,
  ChatContextAgentRunFeature,
  ChatContextFeature,
  ChatContextProject,
  ChatContextProjectTopic,
  ChatContextStory,
  ChatContextStoryTopic,
  ChatMessage,
} from 'thefactory-tools'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import { chatsService } from '@renderer/services/chatsService'
import ChatsNavigationSidebar from '@renderer/components/chat/ChatsNavigationSidebar'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import DotBadge from '@renderer/components/ui/DotBadge'
import { getChatContextPath } from 'thefactory-tools/utils'

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
    case 'AGENT_RUN': {
      const c = context as ChatContextAgentRun
      return `Agent Story Run ${opts.getStoryTitle(c.storyId)}`
    }
    case 'AGENT_RUN_FEATURE': {
      const c = context as ChatContextAgentRunFeature
      return `Agent Feature Run ${opts.getStoryTitle(c.storyId)} / ${opts.getFeatureTitle(c.featureId)}`
    }
    default:
      return 'Chat'
  }
}

// Support deep-linking to specific chat contexts under the chat route
// Formats:
// - #chat/agent-run/<projectId>/<storyId>/<agentRunId>
// - #chat/agent-run-feature/<projectId>/<storyId>/<featureId>/<agentRunId>
function parseChatRouteFromHash(hashRaw: string): ChatContext | undefined {
  const raw = (hashRaw || '').replace(/^#/, '')
  if (!raw.startsWith('chat')) return undefined
  const withoutPrefix = raw.slice('chat'.length) // possibly like '/agent-run/...'
  const parts = withoutPrefix.split('/').filter(Boolean)
  if (parts.length === 0) return undefined

  try {
    const seg = parts[0]
    if (seg === 'agent-run' && parts.length >= 4) {
      const projectId = decodeURIComponent(parts[1])
      const storyId = decodeURIComponent(parts[2])
      const agentRunId = decodeURIComponent(parts[3])
      const ctx: ChatContextAgentRun = { type: 'AGENT_RUN', projectId, storyId, agentRunId }
      return ctx
    }
    if (seg === 'agent-run-feature' && parts.length >= 5) {
      const projectId = decodeURIComponent(parts[1])
      const storyId = decodeURIComponent(parts[2])
      const featureId = decodeURIComponent(parts[3])
      const agentRunId = decodeURIComponent(parts[4])
      const ctx: ChatContextAgentRunFeature = {
        type: 'AGENT_RUN_FEATURE',
        projectId,
        storyId,
        featureId,
        agentRunId,
      }
      return ctx
    }
  } catch (e) {
    console.warn('Failed to parse chat route from hash', e)
  }
  return undefined
}

export default function ChatView() {
  const { projectId: activeProjectId } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { getChat, chats, chatsByProjectId } = useChats()
  const { runsHistory } = useAgents()
  const { hasUnreadForProject } = useChatUnread()

  // Helpers for titles
  const getProjectTitle = (id?: string) => {
    if (!id) return ''
    const p = projects.find((prj) => prj.id === id)
    return p?.title || id
  }
  const getStoryTitle = (id?: string) => {
    if (!id) return ''
    const s = storiesById[id]
    return s?.title || 'Deleted story'
  }
  const getFeatureTitle = (id?: string) => {
    if (!id) return ''
    const f = featuresById[id]
    return f?.title || 'Deleted feature'
  }

  // Selected context state
  const [selectedContext, setSelectedContext] = useState<ChatContext | undefined>(undefined)

  // Sidebar mode state (categories | history)
  const [mode, setMode] = useState<'categories' | 'history'>(() => {
    const saved = localStorage.getItem('chat-sidebar-mode')
    return saved === 'history' ? 'history' : 'categories'
  })
  useEffect(() => {
    localStorage.setItem('chat-sidebar-mode', mode)
  }, [mode])

  // Persist/restore last selected chat
  useEffect(() => {
    const loadLeastRecentlyOpened = (): ChatContext | undefined => {
      try {
        const projId = activeProjectId
        if (!projId) return undefined
        const list = chatsByProjectId[projId] || []
        if (!list.length) return undefined
        const raw = localStorage.getItem(`chat-last-opened:${projId}`)
        const map: Record<string, string> = raw ? JSON.parse(raw) : {}
        let pick: { key: string; ts: string; ctx: ChatContext } | undefined
        for (const c of list) {
          const ts = map[c.key] || '' // missing timestamp => least recently opened
          if (!pick || ts.localeCompare(pick.ts) < 0) {
            pick = { key: c.key, ts, ctx: c.chat.context }
          }
        }
        return pick?.ctx
      } catch {
        return undefined
      }
    }

    const applyFromHash = async (h: string) => {
      const ctx = parseChatRouteFromHash(h)
      if (ctx) {
        try { await getChat(ctx) } catch {}
        setSelectedContext(ctx)
        return
      }
      // Prefer least recently opened chat for this project
      const lruCtx = loadLeastRecentlyOpened()
      if (lruCtx) {
        setSelectedContext(lruCtx)
        return
      }
      // Fallback to General chat for active project
      setSelectedContext({ type: 'PROJECT', projectId: activeProjectId })
    }
    // If a selection already exists, do nothing
    if (!selectedContext) {
      void applyFromHash(window.location.hash)
    }
    const onHash = () => void applyFromHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [getChat, activeProjectId, chatsByProjectId, selectedContext])

  useEffect(() => {
    if (selectedContext) {
      try {
        localStorage.setItem('chat-last-selected-context', JSON.stringify(selectedContext))
      } catch {}
    }
  }, [selectedContext])

  // Track last 'opened' timestamp per chat key in the active project
  useEffect(() => {
    if (!selectedContext || !activeProjectId) return
    try {
      const key = getChatContextPath(selectedContext)
      const storageKey = `chat-last-opened:${activeProjectId}`
      const raw = localStorage.getItem(storageKey)
      const map: Record<string, string> = raw ? JSON.parse(raw) : {}
      map[key] = new Date().toISOString()
      localStorage.setItem(storageKey, JSON.stringify(map))
    } catch {
      // ignore storage errors
    }
  }, [selectedContext, activeProjectId])

  // Seed from agent run history when switching to a run context
  useEffect(() => {
    const maybeSeed = async () => {
      const ctx = selectedContext
      if (!ctx) return
      if (ctx.type !== 'AGENT_RUN' && ctx.type !== 'AGENT_RUN_FEATURE') return

      const run = runsHistory.find((r) => r.id === (ctx as any).agentRunId)
      if (!run) return

      let seedMessages: ChatMessage[] | undefined
      if (ctx.type === 'AGENT_RUN') {
        seedMessages = run.conversations[0]?.messages || []
      } else if (ctx.type === 'AGENT_RUN_FEATURE') {
        const c = run.conversations.find((c) => c.featureId === (ctx as any).featureId)
        if (c) seedMessages = c.messages || []
      }

      if (!seedMessages || seedMessages.length === 0) return

      // IMPORTANT: Only seed if the chat already exists in memory; do not recreate deleted chats
      const key = getChatContextPath(ctx)
      const existing = chats[key]
      if (!existing) return
      const hasMessages = (existing.chat.messages || []).length > 0
      if (hasMessages) return

      try {
        await chatsService.updateChat(ctx, { messages: seedMessages })
      } catch (e) {
        console.warn('Failed to seed agent run chat from history', e)
      }
    }
    maybeSeed()
  }, [selectedContext, runsHistory, chats])

  // Header action: Categories | History switch with unread dot hint if any unread in project
  const headerAction = useMemo(() => {
    const seg = (
      <SegmentedControl
        ariaLabel={'Toggle chat list mode'}
        options={[
          { value: 'categories', label: 'Categories' },
          { value: 'history', label: 'History' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as 'categories' | 'history')}
        size='sm'
      />
    )
    const showDot = hasUnreadForProject(activeProjectId)
    return (
      <div className='flex items-center gap-2'>
        {seg}
        {showDot && <DotBadge title={'Unread chats in this project'} />}
      </div>
    )
  }, [mode, activeProjectId, hasUnreadForProject])

  const collapsedLabel = mode === 'categories' ? 'CATEGORIES' : 'HISTORY'

  return (
    <CollapsibleSidebar
      items={[]}
      activeId={''}
      onSelect={() => {}}
      storageKey="chatview-sidebar-collapsed"
      headerTitle={''}
      headerSubtitle={''}
      headerAction={headerAction}
      collapsedLabel={collapsedLabel}
      navContent={
        <ChatsNavigationSidebar
          selectedContext={selectedContext}
          onSelectContext={(ctx) => setSelectedContext(ctx)}
          mode={mode}
        />
      }
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
