import type { ProjectSpec } from 'src/types/tasks'

export type ServiceResult = { ok: boolean; error?: string; details?: any }

export type ProjectsService = {
  subscribe: (callback: () => void) => () => void
  list: () => Promise<ProjectSpec[]>
  get: (id: string) => Promise<ProjectSpec | undefined>
  create: (spec: ProjectSpec) => Promise<ServiceResult>
  update: (id: string, spec: ProjectSpec) => Promise<ServiceResult>
  delete: (id: string) => Promise<ServiceResult>
}

export const projectsService: ProjectsService = { ...window.projectsService }
