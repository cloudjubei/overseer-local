import React, { useEffect, useMemo, useState } from 'react'
import { ChatSidebar } from '@renderer/components/chat'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useChats } from '@renderer/contexts/ChatsContext'
import type { ChatContext } from 'thefactory-tools'

// Supported high-level categories for the type tiles
// Tiles represent ChatContext.type values (PROJECT_TOPIC/STORY_TOPIC are grouped by type)
const TYPE_ORDER: Array<ChatContext['type']> = [
  'PROJECT',
  'STORY',
  'FEATURE',
  'PROJECT_TOPIC',
  'STORY_TOPIC',
  'AGENT_RUN',
]

function titleForContext(context: ChatContext, projectTitle?: string): string {
  switch (context.type) {
    case 'PROJECT':
      return projectTitle ? `Project Chat — ${projectTitle}` : 'Project Chat'
    case 'STORY':
      return `Story Chat — ${'storyId' in context ? (context as any).storyId : ''}`
    case 'FEATURE': {
      const storyId = 'storyId' in context ? (context as any).storyId : undefined
      const featureId = 'featureId' in context ? (context as any).featureId : undefined
      return `Feature Chat — ${storyId ? storyId + ' / ' : ''}${featureId ?? ''}`
    }
    case 'PROJECT_TOPIC': {
      const topic = (context as any).projectTopic || 'topic'
      const pretty = String(topic)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase())
      return `Project ${pretty} Chat${projectTitle ? ' — ' + projectTitle : ''}`
    }
    case 'STORY_TOPIC': {
      const topic = (context as any).storyTopic || 'topic'
      const storyId = (context as any).storyId || ''
      const pretty = String(topic)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase())
      return `Story ${pretty} Chat — ${storyId}`
    }
    case 'AGENT_RUN': {
      const id = (context as any).agentRunId || ''
      return `Agent Run Chat — ${id}`
    }
    default:
      return 'Chat'
  }
}

function labelForType(t: ChatContext['type']): string {
  switch (t) {
    case 'PROJECT':
      return 'Project'
    case 'STORY':
      return 'Stories'
    case 'FEATURE':
      return 'Features'
    case 'PROJECT_TOPIC':
      return 'Project Topics'
    case 'STORY_TOPIC':
      return 'Story Topics'
    case 'AGENT_RUN':
      return 'Agent Runs'
    default:
      return t
  }
}

function listByType(contexts: ChatContext[], type: ChatContext['type']): ChatContext[] {
  return contexts.filter((c) => c.type === type)
}

export default function ChatView() {
  const { projectId, project } = useActiveProject()
  const { chatsByProjectId, restartChat } = useChats()

  // All chat contexts for the active project
  const projectChats = chatsByProjectId[projectId] || []
  const allContexts: ChatContext[] = useMemo(
    () => projectChats.map((c) => c.chat.context),
    [projectChats],
  )

  // Determine available types for tiles (always include PROJECT)
  const availableTypes = useMemo(() => {
    const set = new Set<ChatContext['type']>()
    set.add('PROJECT')
    for (const c of allContexts) set.add(c.type)
    // Keep stable order per TYPE_ORDER
    return TYPE_ORDER.filter((t) => set.has(t))
  }, [allContexts])

  const [selectedType, setSelectedType] = useState<ChatContext['type']>('PROJECT')

  useEffect(() => {
    // Ensure selected type is valid when available types change
    if (!availableTypes.includes(selectedType)) {
      setSelectedType(availableTypes[0] || 'PROJECT')
    }
  }, [availableTypes.join('|')])

  // For PROJECT, ensure we can always pick a context even if none exists yet
  const contextsForSelectedType: ChatContext[] = useMemo(() => {
    const filtered = listByType(allContexts, selectedType)
    if (selectedType === 'PROJECT') {
      if (filtered.length === 0) {
        return [{ type: 'PROJECT', projectId } as ChatContext]
      }
    }
    return filtered
  }, [allContexts, selectedType, projectId])

  // Selected context state - default to first entry for the selected type
  const [selectedContext, setSelectedContext] = useState<ChatContext | undefined>(undefined)
  useEffect(() => {
    const first = contextsForSelectedType[0]
    setSelectedContext((prev) => {
      if (!prev) return first
      // If previous no longer matches selected type, switch
      if (prev.type !== selectedType) return first
      // If previous was PROJECT but projectId changed
      if (prev.type === 'PROJECT' && 'projectId' in prev && prev.projectId !== projectId)
        return first
      // Otherwise keep selection
      return prev
    })
  }, [contextsForSelectedType.map((c) => JSON.stringify(c)).join('|'), selectedType, projectId])

  const handleNewChat = async () => {
    // Create/Restart a General (Project) chat with current timestamp
    const context: ChatContext = { type: 'PROJECT', projectId }
    await restartChat(context)
    setSelectedType('PROJECT')
    setSelectedContext(context)
  }

  return (
    <div className="flex flex-1 min-h-0 w-full overflow-hidden">
      {/* Left sidebar: type tiles + chats list */}
      <aside className="w-[320px] shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-base)] flex flex-col min-h-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]">
          <div className="text-sm font-semibold text-[var(--text-primary)]">Chats</div>
          <button className="btn" onClick={handleNewChat} title="New General chat">
            New chat
          </button>
        </div>

        {/* Type selection tiles */}
        <div className="p-2 overflow-auto">
          <div className="grid grid-cols-2 gap-2">
            {availableTypes.map((t) => {
              const isActive = t === selectedType
              return (
                <button
                  key={t}
                  className={[
                    'rounded-md px-2 py-3 text-left border',
                    isActive
                      ? 'border-blue-500 ring-1 ring-blue-500/50 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
                  ].join(' ')}
                  onClick={() => setSelectedType(t)}
                >
                  <div className="text-[12px] font-semibold text-[var(--text-primary)]">
                    {labelForType(t)}
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {listByType(allContexts, t).length} item(s)
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-3 pb-2 text-[11px] text-[var(--text-muted)] uppercase tracking-wide">
          {labelForType(selectedType)}
        </div>

        {/* Chats list for selected type */}
        <div className="flex-1 min-h-0 overflow-auto px-2 pb-3 space-y-1">
          {contextsForSelectedType.length === 0 ? (
            <div className="text-[13px] text-[var(--text-secondary)] px-2 py-3">
              No chats for this type.
            </div>
          ) : (
            contextsForSelectedType.map((ctx, idx) => {
              const isActive =
                selectedContext && JSON.stringify(selectedContext) === JSON.stringify(ctx)
              const label = titleForContext(ctx, project?.title)
              return (
                <button
                  key={idx}
                  className={[
                    'w-full text-left rounded-md px-3 py-2 border',
                    isActive
                      ? 'border-blue-500 bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:border-[var(--border-default)]',
                  ].join(' ')}
                  onClick={() => setSelectedContext(ctx)}
                  title={label}
                >
                  <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">
                    {label}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </aside>

      {/* Main chat area: selected chat */}
      <div className="flex-1 min-w-0 min-h-0">
        {selectedContext ? (
          <ChatSidebar
            context={selectedContext}
            chatContextTitle={titleForContext(selectedContext, project?.title)}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[var(--text-secondary)]">
            Select a chat to begin.
          </div>
        )}
      </div>
    </div>
  )
}
