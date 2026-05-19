import { useChats } from '@core/contexts/ChatsContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import type { GetChatResponse } from 'thefactory-ui/headless/api'
import { ChatTopicCreateModal as ChatTopicCreateModalBase } from 'thefactory-ui/web'

export type ChatTopicCreateModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreated: (chat: GetChatResponse) => void
  /** Scope of the topic to create. Defaults to the active-project scope so
   *  existing project ChatView call-sites stay project-shaped. The group
   *  ChatView passes `{ kind: 'group', groupId }` to route through the
   *  `createGroupTopic` mutation. */
  scope?: { kind: 'project' } | { kind: 'group'; groupId: string }
}

/**
 * Web wrapper for the shared "new chat topic" modal. Provides the host
 * context wiring: reads the active project (or the explicit group from
 * `scope`) + calls the matching create-topic mutation.
 */
export default function ChatTopicCreateModal({
  isOpen,
  onClose,
  onCreated,
  scope = { kind: 'project' },
}: ChatTopicCreateModalProps) {
  const { projectId } = useActiveProject()
  const { createProjectTopic, createGroupTopic } = useChats()

  if (scope.kind === 'group') {
    return (
      <ChatTopicCreateModalBase
        isOpen={isOpen}
        onClose={onClose}
        modalTitle="Create Group Topic"
        placeholder="e.g. Planning, Architecture"
        hint="Used as the topic name in the sidebar."
        onCreate={async (title) => {
          const chat = await createGroupTopic(scope.groupId, title)
          onCreated(chat)
          onClose()
        }}
      />
    )
  }

  return (
    <ChatTopicCreateModalBase
      isOpen={isOpen}
      onClose={onClose}
      modalTitle="Create Project Topic"
      placeholder="e.g. Planning, Architecture"
      hint="Used as the topic name in the sidebar."
      disabledReason={projectId ? null : 'Select a project to create a project topic.'}
      onCreate={async (title) => {
        if (!projectId) throw new Error('No active project')
        const chat = await createProjectTopic(projectId, title)
        onCreated(chat)
        onClose()
      }}
    />
  )
}
