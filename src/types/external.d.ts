import type { Task, Feature } from './tasks'

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

declare global {
  interface Window {
    tasksIndex: TasksIndexAPI
  }
}

export {}
