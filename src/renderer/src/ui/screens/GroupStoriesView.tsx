import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { GroupStoriesScreen } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import { useGroupMembers } from './useGroupMembers'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'

/**
 * A group's Stories tab: its group stories — a feature across several of its
 * projects, one story each — and New / Run from a row. The screen lives in
 * `thefactory-ui`; this supplies the group, its projects and the navigations.
 */
export default function GroupStoriesView(): React.JSX.Element | null {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const members = useGroupMembers(groupId)
  const onOpenStory = useCallback(
    (groupStoryId: string) => navigate(`/groups/${groupId}/stories/${groupStoryId}`),
    [navigate, groupId],
  )
  const onOpenRun = useCallback(
    (groupRunId: string) => navigate(`/groups/${groupId}/processes/${groupRunId}`),
    [navigate, groupId],
  )
  const onOpenChat = useCallback(
    (context: ChatContext) => {
      const key = encodeURIComponent(getChatContextKey(context))
      if (context.projectId) navigate(`/projects/${context.projectId}/chat/${key}`)
      else if (context.groupId) navigate(`/groups/${context.groupId}/chat/${key}`)
    },
    [navigate],
  )
  if (!groupId) return null
  return (
    <div className="h-full min-h-0 overflow-auto">
      <GroupStoriesScreen
        groupId={groupId}
        members={members}
        onOpenStory={onOpenStory}
        onOpenRun={onOpenRun}
        onOpenChat={onOpenChat}
        renderModelChip={(slot) => renderLaunchModelChip(slot, { type: 'GROUP', groupId })}
      />
    </div>
  )
}
