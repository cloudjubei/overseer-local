import { FilesIndex } from 'src/renderer/services/fileService';
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
  setContext: (projectId: string) => Promise<void>
}
export interface FileIndexAPI {
  get: () => Promise<FilesIndex>
  subscribe: (callback: (callback: FilesIndex) => void) => () => void
  readFile: (relPath: string, encoding: string) => Promise<string>
  readFileBinary: (relPath: string) => Promise<any>
  writeFile: (relPath: string, content: string, encoding: string) => Promise<void>
  deleteFile: (relPath: string) => Promise<void>
  renameFile: (relPathSource: string, relPathTarget: string) => Promise<void>
  ensureDir: (relPath: string) => Promise<void>
  upload: (name: string, content: string) => Promise<void>
  setContext: (projectId: string) => Promise<void>
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
    fileIndex: FileIndexAPI
    chat: any
    notifications: any
    projectsIndex: ProjectsIndexAPI
  }
}

export {}
