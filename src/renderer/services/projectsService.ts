import type { ProjectSpec } from 'thefactory-tools'

export type ProjectsService = {
  subscribe: (callback: (projects: ProjectSpec[]) => void) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (id: string) => Promise<ProjectSpec | undefined>
  createProject: (spec: ProjectSpec) => Promise<ProjectSpec>
  updateProject: (id: string, spec: ProjectSpec) => Promise<ProjectSpec>
  deleteProject: (id: string) => Promise<void>
  reorderTask: (projectId: string, fromIndex: number, toIndex: number) => Promise<ProjectSpec>
}

export const projectsService: ProjectsService = { ...window.projectsService }
