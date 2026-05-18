import type { RefObject } from 'react'
import { ProjectChip, StoryForm as PackageStoryForm, type StoryFormValues } from 'thefactory-ui/web'
import { useProjects } from '@core/contexts/ProjectsContext'

/**
 * Web app wrapper around `thefactory-ui`'s `StoryForm`. Owns only the
 * web-specific concern: resolving `projectId` to a project title via
 * `ProjectsContext` and rendering the `ProjectChip` in the form header.
 * Everything else (fields, validation, dirty tracking) lives in the
 * package so web + desktop stay in lock-step.
 */
export type WebStoryFormProps = {
  initialValues?: Partial<StoryFormValues>
  onSubmit: (values: StoryFormValues) => void | Promise<void>
  submitting?: boolean
  isCreate?: boolean
  titleRef?: RefObject<HTMLInputElement | null>
  onDirtyChange?: (dirty: boolean) => void
  formId?: string
  projectId?: string
}

export default function StoryForm({
  initialValues,
  onSubmit,
  submitting,
  isCreate,
  titleRef,
  onDirtyChange,
  formId,
  projectId,
}: WebStoryFormProps) {
  const { projects } = useProjects()
  const project = projects.find((p) => p.id === projectId)

  return (
    <PackageStoryForm
      initialValues={initialValues}
      onSubmit={onSubmit}
      submitting={submitting}
      isCreate={isCreate}
      titleRef={titleRef}
      onDirtyChange={onDirtyChange}
      formId={formId}
      renderProjectChip={
        project
          ? () => (
              <ProjectChip label={project.title} description={project.description} nonActionable />
            )
          : undefined
      }
    />
  )
}

export type { StoryFormValues }
