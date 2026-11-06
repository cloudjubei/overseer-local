import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { GroupTicketsScreen } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'

/**
 * A group's Tickets tab: its Jira tickets, to discuss or take. The screen lives in
 * `thefactory-ui`; this supplies the group and the navigations.
 */
export default function GroupTicketsView(): React.JSX.Element | null {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const onOpenStory = useCallback(
    (groupStoryId: string) => navigate(`/groups/${groupId}/stories/${groupStoryId}`),
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
  const onOpenSettings = useCallback(
    () => navigate(`/groups/${groupId}/settings`),
    [navigate, groupId],
  )
  if (!groupId) return null
  return (
    <div className="h-full min-h-0 overflow-auto">
      <GroupTicketsScreen
        groupId={groupId}
        onOpenStory={onOpenStory}
        onOpenChat={onOpenChat}
        onOpenSettings={onOpenSettings}
      />
    </div>
  )
}
