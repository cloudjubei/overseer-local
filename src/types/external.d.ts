import type { Task, Feature, ProjectSpec } from './tasks'

export type ServiceResult = { ok: boolean; error?: string }

export type ReorderTasksPayload = { fromId: number; toIndex: number }
export type ReorderFeaturesPayload = { fromId: string; toIndex: number }

export interface TasksIndexSnapshot {
  tasksById: Record<number, Task>
  orderedIds?: number[]
}

export interface TasksIndexAPI {
  getSnapshot: () => Promise<TasksIndexSnapshot>
  onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
  openTaskCreate: () => Promise<void>
  openFeatureCreate: (taskId: number) => Promise<void>
  addTask: (task: Partial<Task>) => Promise<ServiceResult>
  updateTask: (taskId: number, data: Partial<Task>) => Promise<ServiceResult>
  deleteTask: (taskId: number) => Promise<ServiceResult>
  addFeature: (taskId: number, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
  updateFeature: (taskId: number, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
  deleteFeature: (taskId: number, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (taskId: number, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
  reorderTasks: (payload: ReorderTasksPayload) => Promise<ServiceResult>
}

export type ProjectsIndexSnapshot = {
  root: string
  projectsDir: string
  updatedAt: string | null
  projectsById: Record<string, ProjectSpec>
  orderedIds: string[]
  errors: any[]
  metrics: { lastScanMs: number; lastScanCount: number }
}

export interface ProjectsIndexAPI {
  get: () => Promise<ProjectsIndexSnapshot>
  subscribe: (callback: (snapshot: ProjectsIndexSnapshot) => void) => () => void
}

declare global {
  interface Window {
    tasksIndex: TasksIndexAPI
    docsIndex: {
      get: () => Promise<any>
      subscribe: (callback: (snapshot: any) => void) => () => void
      getFile: (relPath: string) => Promise<string>
      saveFile: (relPath: string, content: string) => Promise<any>
      upload: (name: string, content: Buffer | Uint8Array) => Promise<string>
    }
    chat: any
    notifications: any
    projectsIndex: ProjectsIndexAPI
  }
}

export {}
