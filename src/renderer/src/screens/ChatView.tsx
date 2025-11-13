import React, { useEffect, useMemo, useState } from 'react'
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
import { getChatContextPath, getChatContextFromFilename } from 'thefactory-tools/utils'
import { useNotifications } from '@renderer/hooks/useNotifications'

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

// Support deep-linking to specific chat contexts under the chat route using helpers.
// The hash should be '#chat/' + getChatContextPath(ctx) with the '.json' stripped.
function parseChatRouteFromHash(hashRaw: string): ChatContext | undefined {
  const raw = (hashRaw || '').replace(/^#/, '')
  if (!raw.startsWith('chat')) return undefined
  let path = raw.slice('chat'.length)
  if (path.startsWith('/')) path = path.slice(1)
  if (!path) return undefined
  const filename = path.endsWith('.json') ? path : `${path}.json`
  try {
    return getChatContextFromFilename(filename)
  } catch (e) {
    console.warn('Failed to parse chat route from hash', e)
    return undefined
  }
}

export default function ChatView() {
  const { projectId: activeProjectId } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, featuresById } = useStories()
  const { getChat, chats, chatsByProjectId } = useChats()
  const { runsHistory } = useAgents()
  const { hasUnreadForProject } = useChatUnread()
  const { markNotificationsByMetadata } = useNotifications()

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
  const [selectedContext, setSelectedContext] = useState<ChatContext | undefined>(() => {
    try {
      const raw = localStorage.getItem('chat-last-selected-context')
      if (raw) {
        return JSON.parse(raw)
      }
    } catch (e) {
      console.warn('Failed to parse last-selected-context from localStorage', e)
    }
    return undefined
  })

  // Sidebar mode state (categories | history)
  const [mode, setMode] = useState<'categories' | 'history'>(() => {
    const saved = localStorage.getItem('chat-sidebar-mode')
    return saved === 'history' ? 'history' : 'categories'
  })
  useEffect(() => {
    localStorage.setItem('chat-sidebar-mode', mode)
  }, [mode])

  // Initial selection: honor deep-link; else open most recently used chat after project chats load; else fall back to project chat
  useEffect(() => {
    const hasLoadedProjectChats = !!(
      activeProjectId && Object.prototype.hasOwnProperty.call(chatsByProjectId, activeProjectId)
    )

    const loadMostRecentlyOpened = (): ChatContext | undefined => {
      try {
        const projId = activeProjectId
        if (!projId) return undefined
        const list = chatsByProjectId[projId] || []
        if (!list.length) return undefined
        const raw = localStorage.getItem(`chat-last-opened:${projId}`)
        const map: Record<string, string> = raw ? JSON.parse(raw) : {}
        const candidates = list
          .map((c) => ({ ts: map[c.key] as string | undefined, ctx: c.chat.context }))
          .filter((x) => !!x.ts) as { ts: string; ctx: ChatContext }[]
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.ts.localeCompare(b.ts))
          return candidates[candidates.length - 1].ctx
        }
        return undefined
      } catch {
        return undefined
      }
    }

    const apply = async () => {
      // 1. Handle hash navigation first
      const hashCtx = parseChatRouteFromHash(window.location.hash)
      if (hashCtx) {
        if (!selectedContext || getChatContextPath(hashCtx) !== getChatContextPath(selectedContext)) {
          try {
            await getChat(hashCtx)
          } catch {}
          setSelectedContext(hashCtx)
        }
        return
      }

      // 2. Check if current selection is valid for the active project
      if (selectedContext) {
        const key = getChatContextPath(selectedContext)
        const projectChats = chatsByProjectId[activeProjectId ?? ''] || []
        if (projectChats.some((c) => c.key === key)) {
          return // Current context is valid, do nothing
        }
      }

      // 3. Current context is invalid or missing, find a new one.
      // Wait until chats for this project are loaded.
      if (!hasLoadedProjectChats) {
        if (selectedContext) setSelectedContext(undefined)
        return
      }

      // Find best candidate for new context
      let newContext: ChatContext | undefined = loadMostRecentlyOpened()
      if (!newContext && activeProjectId) {
        newContext = { type: 'PROJECT', projectId: activeProjectId }
      }

      if (newContext) {
        const newKey = getChatContextPath(newContext)
        const oldKey = selectedContext ? getChatContextPath(selectedContext) : undefined
        if (newKey !== oldKey) {
          try {
            await getChat(newContext) // Ensure chat exists
          } catch {}
          // Sync URL hash to canonical chat path (without .json)
          try {
            const hashPath = newKey.replace(/\.json$/, '')
            const targetHash = `#chat/${hashPath}`
            if (window.location.hash !== targetHash) window.location.hash = targetHash
          } catch {}
          setSelectedContext(newContext)
        }
      } else if (selectedContext) {
        setSelectedContext(undefined)
      }
    }

    void apply()

    const onHash = () => void apply()
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

  // When opening/switching chats, mark only matching chat notifications as read (which will delete them in main)
  useEffect(() => {
    if (!selectedContext || !activeProjectId) return
    try {
      const rawPath = getChatContextPath(selectedContext).replace(/\.json$/, '')
      const actionUrl = `#chat/${rawPath}`
      void markNotificationsByMetadata({ actionUrl }, { category: 'chat_messages' })
    } catch (_) {}
  }, [selectedContext, activeProjectId, markNotificationsByMetadata])

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
    void maybeSeed()
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
          onSelectContext={(ctx) => {
            try {
              const p = getChatContextPath(ctx).replace(/\.json$/, '')
              const targetHash = `#chat/${p}`
              if (window.location.hash !== targetHash) window.location.hash = targetHash
            } catch {}
            setSelectedContext(ctx)
          }}
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
