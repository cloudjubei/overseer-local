import React, { useState } from 'react'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'

const getGroupLabel = (group: any) => (group as any).title ?? (group as any).name ?? group.id

const mergeMainGroupSelection = (
  selectedIds: string[],
  mainGroupId: string | null,
  groups: any[],
) => {
  const scopeIds = selectedIds.filter((id) => groups.find((g) => g.id === id)?.type === 'SCOPE')
  return mainGroupId ? [mainGroupId, ...scopeIds] : scopeIds
}

export interface ProjectWizardGroupState {
  groupIds: string[]
}

interface ProjectWizardGroupStepProps {
  initialState?: Partial<ProjectWizardGroupState>
  onStateChange: (state: ProjectWizardGroupState, isValid: boolean) => void
}

export function ProjectWizardGroupStep({
  initialState,
  onStateChange,
}: ProjectWizardGroupStepProps) {
  const { groups } = useProjectsGroups()
  const [groupIds, setGroupIds] = useState<string[]>(initialState?.groupIds || [])

  const handleSelectMainGroup = (id: string) => {
    const isSelected = groupIds.includes(id)
    const nextMainGroupId = isSelected ? null : id
    const newGroupIds = mergeMainGroupSelection(groupIds, nextMainGroupId, groups)
    setGroupIds(newGroupIds)
    onStateChange({ groupIds: newGroupIds }, true)
  }

  const handleToggleScopeGroup = (id: string) => {
    const newGroupIds = groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id]
    setGroupIds(newGroupIds)
    onStateChange({ groupIds: newGroupIds }, true)
  }

  React.useEffect(() => {
    onStateChange({ groupIds }, true)
  }, [])

  const mainGroups = groups.filter((g) => g.type === 'MAIN')
  const scopeGroups = groups.filter((g) => g.type === 'SCOPE')

  return (
    <div className="flex flex-col gap-6 w-[500px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Group Memberships</h2>
        <p className="text-text-low">Optionally assign this project to existing groups.</p>
      </div>
      <div className="bg-surface-raised p-6 rounded-xl border border-border flex flex-col gap-6 max-h-[350px] overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-text-low text-center">No groups available.</p>
        ) : (
          <>
            {mainGroups.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text-low uppercase tracking-wider">
                  Main Groups
                </h3>
                {mainGroups.map((group) => (
                  <label key={group.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group.id)}
                      onChange={() => handleSelectMainGroup(group.id)}
                      className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                    />
                    <span className="text-text-main">
                      {(group as any).title ?? (group as any).name ?? group.id}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {scopeGroups.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-text-low uppercase tracking-wider">
                  Scope Groups
                </h3>
                {scopeGroups.map((group) => (
                  <label key={group.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group.id)}
                      onChange={() => handleToggleScopeGroup(group.id)}
                      className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
                    />
                    <span className="text-text-main">
                      {(group as any).title ?? (group as any).name ?? group.id}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
