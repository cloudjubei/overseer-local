import type { ProjectSpec, ReorderPayload } from 'thefactory-tools'

export type ProjectsService = {
  subscribe: (callback: () => void) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (projectId: string) => Promise<ProjectSpec | undefined>
  createProject: (input: ProjectSpec) => Promise<ProjectSpec>
  updateProject: (projectId: string, patch: ProjectSpec) => Promise<ProjectSpec>
  deleteProject: (projectId: string) => Promise<void>
  reorderTask: (projectId: string, payload: ReorderPayload) => Promise<ProjectSpec>
}

export const projectsService: ProjectsService = { ...window.projectsService }
