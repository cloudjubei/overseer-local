import React, { useEffect, useState } from 'react'
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
  const { getChat } = useChats()
  const { runsHistory } = useAgents()

  // Helpers for titles
  const getProjectTitle = (id?: string) => {
    if (!id) return ''
    const p = projects.find((prj) => prj.id === id)
    return p?.title || id
  }
  const getStoryTitle = (id?: string) => (id ? storiesById[id]?.title || id : '')
  const getFeatureTitle = (id?: string) => (id ? featuresById[id]?.title || id : '')

  // Selected context state
  const [selectedContext, setSelectedContext] = useState<ChatContext | undefined>(undefined)

  // Persist/restore last selected chat
  useEffect(() => {
    const applyFromHash = async (h: string) => {
      const ctx = parseChatRouteFromHash(h)
      if (ctx) {
        try { await getChat(ctx) } catch {}
        setSelectedContext(ctx)
        return
      }
      // Restore last used chat for this project if available
      const raw = localStorage.getItem('chat-last-selected-context')
      if (raw) {
        try {
          const last: ChatContext = JSON.parse(raw)
          if (last && (last as any).projectId === activeProjectId) {
            setSelectedContext(last)
            return
          }
        } catch {}
      }
      // Default to General chat for active project
      setSelectedContext({ type: 'PROJECT', projectId: activeProjectId })
    }
    applyFromHash(window.location.hash)
    const onHash = () => applyFromHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [getChat, activeProjectId])

  useEffect(() => {
    if (selectedContext) {
      try {
        localStorage.setItem('chat-last-selected-context', JSON.stringify(selectedContext))
      } catch {}
    }
  }, [selectedContext])

  // Seed from agent run history when switching to a run context
  useEffect(() => {
    const maybeSeed = async () => {
      const ctx = selectedContext
      if (!ctx) return
      if (ctx.type !== 'AGENT_RUN' && ctx.type !== 'AGENT_RUN_FEATURE') return

      const run = runsHistory.find((r) => r.id === ctx.agentRunId)
      if (!run) return

      let seedMessages: ChatMessage[] | undefined
      if (ctx.type === 'AGENT_RUN') {
        seedMessages = run.conversations[0]?.messages || []
      } else if (ctx.type === 'AGENT_RUN_FEATURE') {
        const c = run.conversations.find((c) => c.featureId === ctx.featureId)
        if (c) seedMessages = c.messages || []
      }

      if (!seedMessages || seedMessages.length === 0) return

      try {
        const chatState = await getChat(ctx)
        const hasMessages = (chatState.chat.messages || []).length > 0
        if (hasMessages) return
        await chatsService.updateChat(ctx, { messages: seedMessages })
      } catch (e) {
        console.warn('Failed to seed agent run chat from history', e)
      }
    }
    maybeSeed()
  }, [selectedContext, runsHistory, getChat])

  // Build header values
  const headerTitle = 'Chats'
  const headerSubtitle = selectedContext
    ? titleForContext(selectedContext, { getProjectTitle, getStoryTitle, getFeatureTitle })
    : ''

  return (
    <CollapsibleSidebar
      items={[]}
      activeId={''}
      onSelect={() => {}}
      storageKey="chatview-sidebar-collapsed"
      headerTitle={headerTitle}
      headerSubtitle={headerSubtitle}
      headerAction={null}
      navContent={
        <ChatsNavigationSidebar
          selectedContext={selectedContext}
          onSelectContext={(ctx) => setSelectedContext(ctx)}
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
