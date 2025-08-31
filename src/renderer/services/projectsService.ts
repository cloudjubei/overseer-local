import type { ProjectSpec } from 'src/types/tasks'
import { ServiceResult } from './serviceResult';

export type ProjectsService = {
  subscribe: (callback: () => void) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (id: string) => Promise<ProjectSpec | undefined>
  createProject: (spec: ProjectSpec) => Promise<ServiceResult>
  updateProject: (id: string, spec: ProjectSpec) => Promise<ServiceResult>
  deleteProjct: (id: string) => Promise<ServiceResult>
  reorderTasks: (project: ProjectSpec, fromIndex: number, toIndex: number) => Promise<ServiceResult> //TODO: project
}

export const projectsService: ProjectsService = { ...window.projectsService }
