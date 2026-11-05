import { useNavigate } from 'react-router-dom'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { useProjects } from 'thefactory-ui/headless'
import { GroupHome, GroupHomeConnected, type GroupHomeProjectCard } from 'thefactory-ui/web'

/**
 * A project group's home. Wraps the shared `GroupHomeConnected` with web-specific
 * data resolution + react-router navigation.
 */
export default function GroupHomeView(): React.JSX.Element {
  const { groups, activeGroupId } = useProjectsGroups()
  const { projects } = useProjects()
  const navigate = useNavigate()

  const group = groups.find((g) => g.id === activeGroupId)
  if (!group) {
    return <GroupHome title="" projects={[]} onSelectProject={() => undefined} isMissing />
  }

  const memberProjects: GroupHomeProjectCard[] = group.projects
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is (typeof projects)[number] => Boolean(p))
    .map((p) => ({
      id: p.id,
      title: p.overrides?.title ?? p.title,
      description: p.overrides?.description ?? p.description,
      iconKey: (p.metadata as { icon?: string } | undefined)?.icon,
    }))

  return (
    <GroupHomeConnected
      groupId={group.id}
      title={group.title}
      typeTag={`${group.type} group`}
      projects={memberProjects}
      onSelectProject={(p) => navigate(`/projects/${p.id}/stories`)}
      onSelectRun={(runId, projectId) => navigate(`/projects/${projectId}/process-runs/${runId}`)}
      onSelectGroupRun={(id) => navigate(`/groups/${group.id}/processes/${id}`)}
    />
  )
}
