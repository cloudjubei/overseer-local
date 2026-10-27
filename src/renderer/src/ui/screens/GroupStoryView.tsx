import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GroupStoryScreen } from 'thefactory-ui/web'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'
import { useGroupMembers } from './GroupStoriesView'

/** One group story's page: its parts by step, Edit, Delete and Run. */
export default function GroupStoryView(): React.JSX.Element | null {
  const { groupId, groupStoryId } = useParams<{ groupId: string; groupStoryId: string }>()
  const navigate = useNavigate()
  const members = useGroupMembers(groupId)
  const onOpenPartStory = useCallback(
    (projectId: string, storyId: string) => navigate(`/projects/${projectId}/stories/${storyId}`),
    [navigate],
  )
  const onOpenRun = useCallback(
    (groupRunId: string) => navigate(`/groups/${groupId}/processes/${groupRunId}`),
    [navigate, groupId],
  )
  const onDeleted = useCallback(
    () => navigate(`/groups/${groupId}/stories`, { replace: true }),
    [navigate, groupId],
  )
  if (!groupId || !groupStoryId) return null
  return (
    <div className="h-full min-h-0 overflow-auto">
      <GroupStoryScreen
        groupId={groupId}
        groupStoryId={groupStoryId}
        members={members}
        onOpenPartStory={onOpenPartStory}
        onOpenRun={onOpenRun}
        onDeleted={onDeleted}
        renderModelChip={(slot) => renderLaunchModelChip(slot, { type: 'GROUP', groupId })}
      />
    </div>
  )
}
