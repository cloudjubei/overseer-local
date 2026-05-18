import { useMemo } from 'react'
import { ChatTopicCreateModal as ChatTopicCreateModalBase } from 'thefactory-ui/web'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { useChats } from '@renderer/contexts/chats/ChatsContext'

type Props = {
  isOpen: boolean
  onClose: () => void
  // Receives the created topic chat context (including generated id) so ChatView can navigate to it.
  onTopicCreated: (ctx: any) => void
}

/**
 * Desktop wrapper around the shared "new chat topic" modal in
 * `thefactory-ui`. Decides project vs group scope from the active
 * selection and delegates to `createTopicChat`.
 */
export default function ChatTopicCreateModal({ isOpen, onClose, onTopicCreated }: Props) {
  const { projectId: activeProjectId } = useActiveProject()
  const { activeSelectionType, activeGroupId } = useProjectsGroups()
  const { createTopicChat } = useChats()

  const scopeLabel = useMemo(() => {
    if (activeSelectionType === 'group') return 'Group'
    return 'Project'
  }, [activeSelectionType])

  const disabledReason = useMemo(() => {
    if (activeSelectionType === 'group') {
      return activeGroupId ? null : 'Select a group to create a group topic.'
    }
    return activeProjectId ? null : 'Select a project to create a project topic.'
  }, [activeSelectionType, activeGroupId, activeProjectId])

  return (
    <ChatTopicCreateModalBase
      isOpen={isOpen}
      onClose={onClose}
      modalTitle={`Create ${scopeLabel} Topic`}
      placeholder="e.g. Planning, Architecture"
      hint="Used as the topic name in the sidebar."
      disabledReason={disabledReason}
      onCreate={async (title) => {
        const chat = await createTopicChat(
          activeSelectionType === 'group' ? 'group' : 'project',
          activeSelectionType === 'group' ? activeGroupId! : activeProjectId!,
          title,
        )
        if (!chat) throw new Error('Failed to create topic chat')
        onTopicCreated(chat.chat.context)
        onClose()
      }}
    />
  )
}
