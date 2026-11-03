import { useMemo } from 'react'
import { useProjects, useProjectsGroups } from 'thefactory-ui/headless'

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
