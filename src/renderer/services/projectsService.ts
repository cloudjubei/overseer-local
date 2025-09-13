import type { ProjectSpec } from 'thefactory-tools'
import { ServiceResult } from './serviceResult'

export type ProjectsService = {
  subscribe: (callback: (projects: ProjectSpec[]) => void) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (id: string) => Promise<ProjectSpec | undefined>
  createProject: (spec: ProjectSpec) => Promise<ProjectSpec>
  updateProject: (id: string, spec: ProjectSpec) => Promise<ProjectSpec>
  deleteProject: (id: string) => Promise<ServiceResult>
  reorderTask: (projectId: string, fromIndex: number, toIndex: number) => Promise<ServiceResult>
}

export const projectsService: ProjectsService = { ...window.projectsService }
