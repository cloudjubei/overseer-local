import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { GroupTicketPageScreen } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'

/** One ticket's page, opened from its row on the group's Tickets tab. Back goes to the Tickets tab. */
export default function GroupTicketView(): React.JSX.Element | null {
  const { groupId, ticketKey } = useParams<{ groupId: string; ticketKey: string }>()
  const navigate = useNavigate()
  const { groups } = useProjectsGroups()
  const homeProjectId = groups.find((g) => g.id === groupId)?.projects[0]
  const onBack = useCallback(() => navigate(`/groups/${groupId}/tickets`), [navigate, groupId])
  const onOpenStory = useCallback(
    (groupStoryId: string) => navigate(`/groups/${groupId}/stories/${groupStoryId}`),
    [navigate, groupId],
  )
  const onOpenPartStory = useCallback(
    (projectId: string, storyId: string) => navigate(`/projects/${projectId}/stories/${storyId}`),
    [navigate],
  )
  const onOpenRun = useCallback(
    (projectId: string, runId: string) => navigate(`/projects/${projectId}/process-runs/${runId}`),
    [navigate],
  )
  const onOpenChat = useCallback(
    (context: ChatContext) => {
      const key = encodeURIComponent(getChatContextKey(context))
      if (context.projectId) navigate(`/projects/${context.projectId}/chat/${key}`)
      else if (context.groupId) navigate(`/groups/${context.groupId}/chat/${key}`)
    },
    [navigate],
  )
  if (!groupId || !ticketKey) return null
  return (
    <div className="h-full min-h-0 overflow-auto">
      <GroupTicketPageScreen
        groupId={groupId}
        ticketKey={ticketKey}
        onBack={onBack}
        onOpenStory={onOpenStory}
        onOpenPartStory={onOpenPartStory}
        onOpenRun={onOpenRun}
        onOpenChat={onOpenChat}
        renderModelChip={(slot) => renderLaunchModelChip(slot, { type: 'GROUP', groupId })}
        {...(homeProjectId ? { runProjectId: homeProjectId } : {})}
      />
    </div>
  )
}
