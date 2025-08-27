import type { ProjectSpec } from 'src/types/tasks'

export type ProjectsIndexSnapshot = {
  root: string
  projectsDir: string
  updatedAt: string | null
  projectsById: Record<string, ProjectSpec>
  orderedIds: string[]
  errors: any[]
  metrics: { lastScanMs: number; lastScanCount: number }
  // optional extra field provided by main for maintenance
  configPathsById?: Record<string, string>
}

export type ServiceResult = { ok: boolean; error?: string; details?: any }

export type ProjectsService = {
  getSnapshot: () => Promise<ProjectsIndexSnapshot>
  onUpdate: (callback: (snapshot: ProjectsIndexSnapshot) => void) => () => void
  list: () => Promise<ProjectSpec[]>
  getById: (id: string) => Promise<ProjectSpec | undefined>
  create: (spec: ProjectSpec) => Promise<ServiceResult>
  update: (id: string, spec: ProjectSpec) => Promise<ServiceResult>
  remove: (id: string) => Promise<ServiceResult>
}

export const projectsService: ProjectsService = {
  getSnapshot: () => window.projectsIndex.get(),
  onUpdate: (callback) => window.projectsIndex.subscribe(callback),
  list: async () => {
    const snap = await window.projectsIndex.get()
    return snap.orderedIds.map(id => snap.projectsById[id]).filter(Boolean)
  },
  getById: async (id: string) => {
    const snap = await window.projectsIndex.get()
    return snap.projectsById[id]
  },
  create: (spec) => window.projectsIndex.create(spec),
  update: (id, spec) => window.projectsIndex.update(id, spec),
  remove: (id) => window.projectsIndex.delete(id),
}
