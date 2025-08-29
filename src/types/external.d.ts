import type { ProjectSpec } from './tasks'
import { ProjectsService } from 'src/renderer/services/projectsService';
import type { ChatsService } from 'src/renderer/services/chatsService'
import type { FilesService, FilesIndexSnapshot } from 'src/renderer/services/filesService'

export type ServiceResult = { ok: boolean; error?: string }

export type ReorderTasksPayload = { fromId: number; toIndex: number }
export type ReorderFeaturesPayload = { fromId: string; toIndex: number }

export interface TasksIndexSnapshot {
  tasksById: Record<number, any>
  orderedIds?: number[]
}

export interface TasksIndexAPI {
  getSnapshot: () => Promise<TasksIndexSnapshot>
  onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
  addTask: (task: Partial<any>) => Promise<ServiceResult>
  updateTask: (taskId: number, data: Partial<any>) => Promise<ServiceResult>
  deleteTask: (taskId: number) => Promise<ServiceResult>
  addFeature: (taskId: number, feature: any) => Promise<ServiceResult>
  updateFeature: (taskId: number, featureId: string, data: Partial<any>) => Promise<ServiceResult>
  deleteFeature: (taskId: number, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (taskId: number, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
  reorderTasks: (payload: ReorderTasksPayload) => Promise<ServiceResult>
  setContext: (projectId: string) => Promise<void>
  subscribe?: (callback: () => void) => () => void
}

declare global {
  interface Window {
    tasksService: TasksIndexAPI
    tasksIndex: TasksIndexAPI
    chatsService: ChatsService
    notifications: any
    notificationsService: any
    projectsService: ProjectsService
    filesService: FilesService
    files?: FilesService
  }
}

export type { FilesService, FilesIndexSnapshot }
export {}
