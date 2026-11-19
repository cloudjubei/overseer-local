import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { GroupTicketsScreen } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'

/**
 * A group's Tickets tab: its Jira tickets by status tab, to open, discuss, take or
 * review. The screen lives in `thefactory-ui`; this supplies the group, the model
 * chip and the navigations — a row opens the ticket's page.
 */
export default function GroupTicketsView(): React.JSX.Element | null {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const { groups } = useProjectsGroups()
  const homeProjectId = groups.find((g) => g.id === groupId)?.projects[0]
  const onOpenRun = useCallback(
    (runId: string) => {
      if (homeProjectId) navigate(`/projects/${homeProjectId}/process-runs/${runId}`)
    },
    [navigate, homeProjectId],
  )
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
  const onOpenTicket = useCallback(
    (ticketKey: string) => navigate(`/groups/${groupId}/tickets/${encodeURIComponent(ticketKey)}`),
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
        onOpenTicket={onOpenTicket}
        renderModelChip={(slot) => renderLaunchModelChip(slot, { type: 'GROUP', groupId })}
        {...(homeProjectId ? { onOpenRun } : {})}
      />
    </div>
  )
}
