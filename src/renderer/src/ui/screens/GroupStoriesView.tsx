import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProjects, useProjectsGroups } from 'thefactory-ui/headless'
import { GroupStoriesScreen } from 'thefactory-ui/web'
import { renderLaunchModelChip } from '@ui/components/agents/RunModelChipConnected'

/** The group's member projects as the group story screens take them, in the group's order. */
export function useGroupMembers(groupId: string | undefined): { id: string; title: string }[] {
  const { groups } = useProjectsGroups()
  const { projects } = useProjects()
  return useMemo(() => {
    const group = groups.find((g) => g.id === groupId)
    return (group?.projects ?? []).map((id) => ({
      id,
      title: projects.find((p) => p.id === id)?.title ?? id,
    }))
  }, [groups, projects, groupId])
}

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
