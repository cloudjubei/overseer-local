import { useNavigate } from 'react-router-dom'
import { useProjectsGroups } from 'thefactory-ui/headless'
import { useProjects } from 'thefactory-ui/headless'
import { GroupHome, type GroupHomeProjectCard } from 'thefactory-ui/web'

/**
 * Landing page for a project group. Wraps the shared `GroupHome` primitive
 * with web-specific data resolution + react-router navigation.
 */
export default function GroupHomeView() {
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
      title: p.title,
      description: p.description,
      iconKey: (p.metadata as { icon?: string } | undefined)?.icon,
    }))

  return (
    <GroupHome
      title={group.title}
      typeTag={`${group.type} group`}
      projects={memberProjects}
      onSelectProject={(p) => navigate(`/projects/${p.id}/stories`)}
    />
  )
}
