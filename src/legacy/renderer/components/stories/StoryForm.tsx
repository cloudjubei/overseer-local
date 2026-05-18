/**
 * `StoryForm` is owned by `thefactory-ui` so web and desktop stay in
 * lock-step. This file is a thin app-side wrapper that injects desktop's
 * project chip via `ProjectContext` + `Navigator`; everything else is the
 * package primitive.
 */
import { ProjectChip, StoryForm as PackageStoryForm } from 'thefactory-ui/web'
import type { StoryFormProps as PackageStoryFormProps, StoryFormValues } from 'thefactory-ui/web'
import { useProjectContext } from '../../contexts/ProjectContext'
import { useNavigator } from '../../navigation/Navigator'

export type StoryFormProps = Omit<PackageStoryFormProps, 'renderProjectChip'> & {
  projectId?: string
}

export default function StoryForm({ projectId, ...rest }: StoryFormProps) {
  const { projects, setActiveProjectId } = useProjectContext()
  const { navigateView } = useNavigator()
  const project = projects.find((p) => p.id === projectId)

  return (
    <PackageStoryForm
      {...rest}
      renderProjectChip={
        project
          ? () => (
              <ProjectChip
                label={project.title}
                description={project.description}
                onClick={() => {
                  if (projectId) {
                    setActiveProjectId(projectId)
                    navigateView('Home')
                  }
                }}
              />
            )
          : undefined
      }
    />
  )
}

export type { StoryFormValues }
