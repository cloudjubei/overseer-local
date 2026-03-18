import React, { useMemo } from 'react'
import { useProjectsGroups } from '../contexts/ProjectsGroupsContext'
import { useProjectContext } from '../contexts/ProjectContext'
import { renderProjectIcon } from './projects/projectIcons'
import { IconWarningTriangle } from '../components/ui/icons/Icons'
import { useNavigator } from '../navigation/Navigator'

export default function GroupHomeView() {
  const { activeGroupId, groups, setActiveSelectionType } = useProjectsGroups()
  const { projects, setActiveProjectId } = useProjectContext()
  const { navigateView } = useNavigator()

  const group = useMemo(() => {
    return groups.find((g) => g.id === activeGroupId)
  }, [groups, activeGroupId])

  const groupProjects = useMemo(() => {
    if (!group?.projects) return []
    return group.projects
      .map((pid) => projects.find((p) => p.id === pid))
      .filter(Boolean) as any[]
  }, [group, projects])

  if (!group) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-[var(--text-secondary)]">
        <IconWarningTriangle className="w-8 h-8 mr-2" />
        Group not found.
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto bg-[var(--surface-default)] text-[var(--text-primary)] p-8">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-semibold mb-2">{group.title}</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          This group contains {groupProjects.length} project{groupProjects.length === 1 ? '' : 's'}.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupProjects.map((p) => {
            const iconKey = p.metadata?.icon || 'folder'
            const projectIcon = renderProjectIcon(iconKey)

            return (
              <button
                key={p.id}
                onClick={() => {
                  setActiveSelectionType('project')
                  setActiveProjectId(p.id)
                  navigateView('Home')
                }}
                className="flex items-center gap-3 p-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] hover:bg-[var(--surface-overlay)] hover:border-[var(--border-default)] transition-colors text-left"
              >
                <div className="text-xl text-[var(--accent-primary)]">{projectIcon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {p.id}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
