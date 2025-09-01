import type { ProjectSpec } from 'src/types/tasks'
import { ServiceResult } from './serviceResult';

export type ProjectsService = {
  subscribe: (callback: (projects: ProjectSpec[]) => void) => () => void
  listProjects: () => Promise<ProjectSpec[]>
  getProject: (id: string) => Promise<ProjectSpec | undefined>
  createProject: (spec: ProjectSpec) => Promise<ServiceResult>
  updateProject: (id: string, spec: ProjectSpec) => Promise<ServiceResult>
  deleteProjct: (id: string) => Promise<ServiceResult>
  reorderTask: (projectId: string, fromIndex: number, toIndex: number) => Promise<ServiceResult>
}

export const projectsService: ProjectsService = { ...window.projectsService }
