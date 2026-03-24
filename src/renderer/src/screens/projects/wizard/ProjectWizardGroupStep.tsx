import React, { useState } from 'react'
import { Select } from '@renderer/components/ui/Select'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'

export interface ProjectWizardGroupState {
  groupIds: string[]
}

interface ProjectWizardGroupStepProps {
  initialState?: Partial<ProjectWizardGroupState>
  onStateChange: (state: ProjectWizardGroupState, isValid: boolean) => void
}

export function ProjectWizardGroupStep({ initialState, onStateChange }: ProjectWizardGroupStepProps) {
  const { groups } = useProjectsGroups()
  const [groupIds, setGroupIds] = useState<string[]>(initialState?.groupIds || [])

  const handleToggleGroup = (id: string) => {
    const newGroupIds = groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id]
    setGroupIds(newGroupIds)
    onStateChange({ groupIds: newGroupIds }, true) // always valid
  }

  React.useEffect(() => {
    onStateChange({ groupIds }, true)
  }, [])

  return (
    <div className="flex flex-col gap-6 w-[500px]">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-text-high mb-2">Group Memberships</h2>
        <p className="text-text-low">Optionally assign this project to existing groups.</p>
      </div>
      <div className="bg-surface-raised p-6 rounded-xl border border-border flex flex-col gap-4 max-h-[300px] overflow-y-auto">
        {groups.length === 0 ? (
          <p className="text-text-low text-center">No groups available.</p>
        ) : (
          groups.map((group) => (
            <label key={group.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={groupIds.includes(group.id)}
                onChange={() => handleToggleGroup(group.id)}
                className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary focus:ring-2"
              />
              <span className="text-text-main">{group.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
