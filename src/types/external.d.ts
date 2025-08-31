import { FilesIndex } from 'src/renderer/services/fileService';
import type { Task, Feature, ProjectSpec } from './tasks'

export type ServiceResult = { ok: boolean; error?: string }

// When reordering tasks/features, identifiers are UUID strings.
export type ReorderTasksPayload = { fromIndex: number; toIndex: number }
export type ReorderFeaturesPayload = { fromIndex: number; toIndex: number }

export interface TasksIndexSnapshot {
  // All task IDs are UUID strings
  tasksById: Record<string, Task>
  orderedIds: string[]
}

export interface TasksIndexAPI {
  getSnapshot: () => Promise<TasksIndexSnapshot>
onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
openTaskCreate: (project: ProjectSpec) => Promise<void>
openFeatureCreate: (project: ProjectSpec, taskId: string) => Promise<void>
addTask: (project: ProjectSpec, task: Partial<Task>) => Promise<ServiceResult>
updateTask: (project: ProjectSpec, taskId: string, data: Partial<Task>) => Promise<ServiceResult>
deleteTask: (project: ProjectSpec, taskId: string) => Promise<ServiceResult>
addFeature: (project: ProjectSpec, taskId: string, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
updateFeature: (project: ProjectSpec, taskId: string, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
deleteFeature: (project: ProjectSpec, taskId: string, featureId: string) => Promise<ServiceResult>
reorderFeatures: (project: ProjectSpec, taskId: string, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
reorderTasks: (project: ProjectSpec, payload: ReorderTasksPayload) => Promise<ServiceResult>
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
