import React, { useEffect, useMemo, useState } from 'react'
import { ChatSidebar } from '@renderer/components/chat'
import { useProjectContext, useActiveProject } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useChats } from '@renderer/contexts/chats/ChatsContext'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import type {
  ChatContext,
  ChatContextAgentRun,
  ChatContextAgentRunFeature,
  ChatContextAgentRunStory,
  ChatContextFeature,
  ChatContextGroup,
  ChatContextGroupTopic,
  ChatContextProject,
  ChatContextProjectTopic,
  ChatContextStory,
} from 'thefactory-tools'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import ChatsNavigationSidebar from '@renderer/components/chat/ChatsNavigationSidebar'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import DotBadge from '@renderer/components/ui/DotBadge'
import { getChatContextKey, getChatContext } from 'thefactory-tools/utils'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { useNotifications } from '@renderer/hooks/useNotifications'
import { useAgents } from '@renderer/contexts/AgentsContext'
import ChatTopicCreateModal from '@renderer/components/chat/ChatTopicCreateModal'
import { IconPlus } from '@renderer/components/ui/icons/Icons'

function titleForContext(
  context: ChatContext,
  opts: {
    getProjectTitle: (id?: string) => string
    getStoryTitle: (id?: string) => string
    getFeatureTitle: (id?: string) => string
    getGroupTitle: (id?: string) => string
  },
  chatTitle?: string,
): string {
  switch (context.type) {
    case 'GROUP':
      return `Group Chat — ${opts.getGroupTitle((context as ChatContextGroup).groupId)}`
    case 'GROUP_TOPIC': {
      const c = context as ChatContextGroupTopic
      return `Group ${chatTitle ?? 'Topic'}`
    }
    case 'PROJECT':
      return `Project Chat — ${opts.getProjectTitle((context as ChatContextProject).projectId)}`
    case 'PROJECT_TOPIC': {
      const c = context as ChatContextProjectTopic
      return `Project ${chatTitle ?? 'Topic'}`
    }
    case 'STORY':
      return `Story Chat — ${opts.getStoryTitle((context as ChatContextStory).storyId)}`
    case 'AGENT_RUN_STORY': {
      const c = context as ChatContextAgentRun
      return `Agent Story Run ${opts.getStoryTitle(c.storyId)}`
    }
    case 'FEATURE': {
      const c = context as ChatContextFeature
      return `Feature Chat — ${opts.getStoryTitle(c.storyId)} / ${opts.getFeatureTitle(c.featureId)}`
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
// The hash should be '#chat/' + getChatContextKey(ctx)
function parseChatRouteFromHash(hashRaw: string): ChatContext | undefined {
  const raw = (hashRaw || '').replace(/^#/, '')
  if (!raw.startsWith('chats')) return undefined
  let path = raw.slice('chats'.length)
  if (path.startsWith('/')) path = path.slice(1)
  if (!path) return undefined
  try {
    return getChatContext(path)
  } catch (e) {
    console.warn('Failed to parse chat route from hash', e)
    return undefined
  }
}

export default function ChatView() {
  const { projectId: activeProjectId } = useActiveProject()
  const { projects } = useProjectContext()
  const { groups, activeGroupId, activeSelectionType } = useProjectsGroups()
  const { storiesById, featuresById } = useStories()
  const { getChatIfExists, chatsByProjectId, chats } = useChats()
  const { markNotificationsByMetadata, getGroupOwnBadgeState, getProjectBadgeState } =
    useNotifications()
  const { markRunSeen } = useAgents()
  const { appSettings } = useAppSettings()

  // Modal state
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false)

  // Helpers for titles
  const getProjectTitle = (id?: string) => {
    if (!id) return ''
    const p = projects.find((prj) => prj.id === id)
    return p?.title || id
  }
  const getGroupTitle = (id?: string) => {
    if (!id) return ''
    const g = groups.find((grp) => grp.id === id)
    return g?.title || id
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

  const onSelectChatContext = (context: ChatContext) => {
    try {
      const p = getChatContextKey(context)
      const targetHash = `#chats${p}`
      if (window.location.hash !== targetHash) window.location.hash = targetHash
    } catch {}
  }

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
      const isValidContext = (ctx: ChatContext | undefined): boolean => {
        if (!ctx) return false
        if (activeSelectionType === 'group' && activeGroupId) {
          return ctx.type === 'GROUP' || ctx.type === 'GROUP_TOPIC'
        } else {
          const key = getChatContextKey(ctx)
          const projectChats = chatsByProjectId[activeProjectId ?? ''] || []
          return (
            projectChats.some((c) => c.key === key) ||
            (ctx.type === 'PROJECT' && ctx.projectId === activeProjectId)
          )
        }
      }

      // 1. Handle hash navigation first
      const hashCtx = parseChatRouteFromHash(window.location.hash)
      if (hashCtx && isValidContext(hashCtx)) {
        if (!selectedContext || getChatContextKey(hashCtx) !== getChatContextKey(selectedContext)) {
          await getChatIfExists(hashCtx)
          setSelectedContext(hashCtx)
        }
        return
      }

      // 2. Check if current selection is valid for the active project/group
      if (isValidContext(selectedContext)) {
        return // Current context is valid, do nothing
      }

      // 3. Current context is invalid or missing, find a new one.
      // Wait until chats for this project are loaded.
      if (activeSelectionType === 'project' && !hasLoadedProjectChats) {
        if (selectedContext) setSelectedContext(undefined)
        return
      }

      // Find best candidate for new context
      let newContext: ChatContext | undefined = undefined
      if (activeSelectionType === 'group' && activeGroupId) {
        newContext = { type: 'GROUP', groupId: activeGroupId } as ChatContextGroup
      } else {
        newContext = loadMostRecentlyOpened()
        if (!newContext && activeProjectId) {
          newContext = { type: 'PROJECT', projectId: activeProjectId } as ChatContextProject
        }
      }

      if (newContext) {
        const newKey = getChatContextKey(newContext)
        const oldKey = selectedContext ? getChatContextKey(selectedContext) : undefined
        if (newKey !== oldKey) {
          await getChatIfExists(newContext) // Ensure chat exists (without throwing)
          // Sync URL hash to canonical chat path (without .json)
          try {
            const targetHash = `#chats${newKey}`
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
  }, [
    getChatIfExists,
    activeProjectId,
    activeGroupId,
    activeSelectionType,
    chatsByProjectId,
    selectedContext,
  ])

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
    if (selectedContext.type === 'GROUP') return
    try {
      const key = getChatContextKey(selectedContext)
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
      const chatKey = getChatContextKey(selectedContext)
      const actionUrl = `#chats${chatKey}`

      void markNotificationsByMetadata(
        { actionUrl },
        { category: 'chat_messages', projectId: activeProjectId },
      )

      if (
        selectedContext.type === 'AGENT_RUN_STORY' ||
        selectedContext.type === 'AGENT_RUN_FEATURE'
      ) {
        markRunSeen(
          (selectedContext as ChatContextAgentRunStory | ChatContextAgentRunFeature).agentRunId,
        )
      }
    } catch (_) {}
  }, [selectedContext, activeProjectId, markNotificationsByMetadata, markRunSeen])

  // Header action: Categories | History switch with unread dot hint, plus the 'create topic' button
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
        size="sm"
      />
    )

    let showChatDot = false
    let showAgentDot = false

    if (activeSelectionType === 'group' && activeGroupId) {
      const groupBadge = getGroupOwnBadgeState(activeGroupId)
      showChatDot = groupBadge.chat_messages.unread > 0
      showAgentDot = groupBadge.agent_runs.unread > 0 || groupBadge.agent_runs.running > 0
    } else {
      const projBadge = getProjectBadgeState(activeProjectId)
      showChatDot = projBadge.chat_messages.unread > 0
      showAgentDot = projBadge.agent_runs.unread > 0 || projBadge.agent_runs.running > 0
    }

    const chatBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.chat_messages
    const agentBadgeColor = appSettings?.notificationSystemSettings?.badgeColors?.agent_runs

    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          {seg}
          {(showChatDot || showAgentDot) && (
            <div className="absolute -top-1 -right-1 flex flex-col gap-[2px]">
              {showChatDot && (
                <DotBadge
                  title="Unread chats"
                  colorClass={chatBadgeColor ? `bg-${chatBadgeColor}-500` : 'bg-red-500'}
                  className="w-[6px] h-[6px]"
                />
              )}
              {showAgentDot && (
                <DotBadge
                  title="Unread agent runs"
                  colorClass={agentBadgeColor ? `bg-${agentBadgeColor}-500` : 'bg-blue-500'}
                  className="w-[6px] h-[6px]"
                />
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsTopicModalOpen(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
          title="Create custom chat topic"
          aria-label="Create custom chat topic"
        >
          <IconPlus className="w-5 h-5" />
        </button>
      </div>
    )
  }, [
    mode,
    activeProjectId,
    activeGroupId,
    activeSelectionType,
    getGroupOwnBadgeState,
    getProjectBadgeState,
    appSettings,
  ])

  const collapsedLabel = mode === 'categories' ? 'CATEGORIES' : 'HISTORY'

  return (
    <>
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
            onSelectContext={onSelectChatContext}
            mode={mode}
          />
        }
      >
        {selectedContext ? (
          <ChatSidebar
            context={selectedContext}
            chatContextTitle={titleForContext(
              selectedContext,
              {
                getProjectTitle,
                getGroupTitle,
                getStoryTitle,
                getFeatureTitle,
              },
              chats[getChatContextKey(selectedContext)]?.chat.title,
            )}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[var(--text-secondary)]">
            Select a chat to begin.
          </div>
        )}
      </CollapsibleSidebar>

      <ChatTopicCreateModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onTopicCreated={onSelectChatContext}
      />
    </>
  )
}
