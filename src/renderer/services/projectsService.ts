import type { ProjectSpec } from 'src/types/tasks'

export type ProjectsIndexSnapshot = {
  root: string
  projectsDir: string
  updatedAt: string | null
  projectsById: Record<string, ProjectSpec>
  orderedIds: string[]
  errors: any[]
  metrics: { lastScanMs: number; lastScanCount: number }
}

export type ProjectsService = {
  getSnapshot: () => Promise<ProjectsIndexSnapshot>
  onUpdate: (callback: (snapshot: ProjectsIndexSnapshot) => void) => () => void
  list: () => Promise<ProjectSpec[]>
  getById: (id: string) => Promise<ProjectSpec | undefined>
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
  }
}
