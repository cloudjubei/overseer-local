import type { ProjectSpec, ReorderPayload, ProjectUpdate } from 'thefactory-tools'

export type ProjectsService = {
  subscribe: (callback: (projectUpdate: ProjectUpdate) => Promise<void>) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (projectId: string) => Promise<ProjectSpec | undefined>
  createProject: (input: ProjectSpec) => Promise<ProjectSpec>
  updateProject: (projectId: string, patch: ProjectSpec) => Promise<ProjectSpec | undefined>
  deleteProject: (projectId: string) => Promise<void>
  reorderStory: (projectId: string, payload: ReorderPayload) => Promise<ProjectSpec | undefined>
}

export const projectsService: ProjectsService = { ...window.projectsService }
