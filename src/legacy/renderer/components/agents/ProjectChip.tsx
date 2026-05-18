import { useMemo } from 'react'
import { ProjectChip as ProjectChipBase } from 'thefactory-ui/web'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useNavigator } from '../../navigation/Navigator'

export default function ProjectChip({
  projectId,
  className,
  nonActionable = false,
}: {
  projectId?: string | null
  className?: string
  nonActionable?: boolean
}) {
  const { projects, setActiveProjectId } = useProjectContext()
  const { navigateView } = useNavigator()

  const proj = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId])
  const label = proj?.title || projectId || '—'
  const description = proj?.description || ''

  return (
    <ProjectChipBase
      label={label}
      description={description}
      nonActionable={nonActionable || !projectId}
      className={className}
      onClick={
        projectId
          ? () => {
              setActiveProjectId(projectId)
              navigateView('Home')
            }
          : undefined
      }
    />
  )
}
