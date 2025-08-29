import type { Task, Feature } from 'src/types/tasks'
import type { TasksIndexSnapshot, ReorderFeaturesPayload, ReorderTasksPayload, ServiceResult } from '../../types/external'

export type TaskCreateInput = Pick<Task, 'status' | 'title' | 'description'> & Partial<Pick<Task, 'features' | 'rejection' | 'dependencies'>>

export type TaskService = {
  getSnapshot: () => Promise<TasksIndexSnapshot>
  onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
  addTask: (task: TaskCreateInput) => Promise<ServiceResult>
  updateTask: (taskId: number, data: Partial<Task>) => Promise<ServiceResult>
  deleteTask: (taskId: number) => Promise<ServiceResult>
  addFeature: (taskId: number, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
  updateFeature: (taskId: number, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
  deleteFeature: (taskId: number, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (taskId: number, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
  reorderTasks: (payload: ReorderTasksPayload) => Promise<ServiceResult>
}

export const taskService: TaskService = {
  getSnapshot: () => window.tasksIndex.getSnapshot(),
  onUpdate: (callback) => window.tasksIndex.onUpdate(callback),
  addTask: (task) => window.tasksIndex.addTask(task),
  updateTask: (taskId, data) => window.tasksIndex.updateTask(taskId, data),
  deleteTask: (taskId) => window.tasksIndex.deleteTask(taskId),
  addFeature: (taskId, feature) => window.tasksIndex.addFeature(taskId, feature),
  updateFeature: (taskId, featureId, data) => window.tasksIndex.updateFeature(taskId, featureId, data),
  deleteFeature: (taskId, featureId) => window.tasksIndex.deleteFeature(taskId, featureId),
  reorderFeatures: (taskId, payload) => window.tasksIndex.reorderFeatures(taskId, payload),
  reorderTasks: (payload) => window.tasksIndex.reorderTasks(payload),
}
