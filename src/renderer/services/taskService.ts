import type { Task, Feature, ProjectSpec } from 'src/types/tasks'
import type { TasksIndexSnapshot, ReorderFeaturesPayload, ReorderTasksPayload, ServiceResult } from '../../types/external'

export type TaskCreateInput = Pick<Task, 'status' | 'title' | 'description'> & Partial<Pick<Task, 'features' | 'rejection' | 'dependencies'>>

export type TaskService = {
  getSnapshot: () => Promise<TasksIndexSnapshot>
  onUpdate: (callback: (snapshot: TasksIndexSnapshot) => void) => () => void
  addTask: (project: ProjectSpec, task: TaskCreateInput) => Promise<ServiceResult>
  updateTask: (project: ProjectSpec, taskId: string, data: Partial<Task>) => Promise<ServiceResult>
  deleteTask: (project: ProjectSpec, taskId: string) => Promise<ServiceResult>
  addFeature: (project: ProjectSpec, taskId: string, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
  updateFeature: (project: ProjectSpec, taskId: string, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
  deleteFeature: (project: ProjectSpec, taskId: string, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (project: ProjectSpec, taskId: string, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
  reorderTasks: (project: ProjectSpec, payload: ReorderTasksPayload) => Promise<ServiceResult>
}

export const taskService: TaskService = {
  getSnapshot: () => window.tasksIndex.getSnapshot(),
  onUpdate: (callback) => window.tasksIndex.onUpdate(callback),
  addTask: (project, task) => window.tasksIndex.addTask(project, task),
  updateTask: (project, taskId, data) => window.tasksIndex.updateTask(project, taskId, data),
  deleteTask: (project, taskId) => window.tasksIndex.deleteTask(project, taskId),
  addFeature: (project, taskId, feature) => window.tasksIndex.addFeature(project, taskId, feature),
  updateFeature: (project, taskId, featureId, data) => window.tasksIndex.updateFeature(project, taskId, featureId, data),
  deleteFeature: (project, taskId, featureId) => window.tasksIndex.deleteFeature(project, taskId, featureId),
  reorderFeatures: (project, taskId, payload) => window.tasksIndex.reorderFeatures(project, taskId, payload),
  reorderTasks: (project, payload) => window.tasksIndex.reorderTasks(project, payload),
}
