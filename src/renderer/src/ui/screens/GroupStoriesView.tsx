import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { GroupStoriesScreen } from 'thefactory-ui/web'
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
  if (!groupId) return null
  return (
    <div className="h-full min-h-0 overflow-auto">
      <GroupStoriesScreen
        groupId={groupId}
        members={members}
        onOpenStory={onOpenStory}
        onOpenRun={onOpenRun}
        renderModelChip={(slot) => renderLaunchModelChip(slot, { type: 'GROUP', groupId })}
      />
    </div>
  )
}
