import { useMemo } from 'react'
import { GroupHome, type GroupHomeProjectCard } from 'thefactory-ui/web'
import { useProjectsGroups } from '../contexts/ProjectsGroupsContext'
import { useProjectContext } from '../contexts/ProjectContext'
import { useNavigator } from '../navigation/Navigator'

export default function GroupHomeView() {
  const { activeGroupId, groups, setActiveSelectionType } = useProjectsGroups()
  const { projects, setActiveProjectId } = useProjectContext()
  const { navigateView } = useNavigator()

  const group = useMemo(() => groups.find((g) => g.id === activeGroupId), [groups, activeGroupId])

  const groupProjects: GroupHomeProjectCard[] = useMemo(() => {
    if (!group?.projects) return []
    return group.projects
      .map((pid) => projects.find((p) => p.id === pid))
      .filter((p): p is (typeof projects)[number] => Boolean(p))
      .map((p) => ({
        id: p.id,
        title: p.title,
        description: (p as { description?: string }).description,
        iconKey: (p.metadata as { icon?: string } | undefined)?.icon,
      }))
  }, [group, projects])

  if (!group) {
    return <GroupHome title="" projects={[]} onSelectProject={() => undefined} isMissing />
  }

  return (
    <GroupHome
      title={group.title}
      projects={groupProjects}
      onSelectProject={(p) => {
        setActiveSelectionType('project')
        setActiveProjectId(p.id)
        navigateView('Home')
      }}
    />
  )
}
