import type { Feature, ProjectSpec, Status, Task } from 'src/types/tasks'
import { ServiceResult } from './serviceResult';

export const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}
export type ReferenceKind = 'task' | 'feature';

export interface ResolvedTaskRef {
  kind: 'task';
  id: string;
  taskId: string;
  task: Task;
  display: string;
}

export interface ResolvedFeatureRef {
  kind: 'feature';
  id: string;
  taskId: string;
  featureId: string;
  task: Task;
  feature: Feature;
  display: string;
}

export type ResolvedRef = ResolvedTaskRef | ResolvedFeatureRef;

export interface InvalidRefError {
  id: string;
  code:
    | 'EMPTY'
    | 'BAD_FORMAT'
    | 'BAD_TASK_ID'
    | 'TASK_NOT_FOUND'
    | 'FEATURE_NOT_FOUND';
  message: string;
}

export type TaskCreateInput = Pick<Task, 'status' | 'title' | 'description'> & Partial<Pick<Task, 'features' | 'rejection' | 'dependencies'>>

export type ReorderFeaturesPayload = { fromIndex: number; toIndex: number }

export type TasksService = {
  subscribe: (callback: () => void) => () => void
  listTasks: (project: ProjectSpec) => Promise<Task[]>
  getTask: (project: ProjectSpec, taskId: string) => Promise<Task | undefined>
  createTask: (project: ProjectSpec, task: TaskCreateInput) => Promise<ServiceResult>
  updateTask: (project: ProjectSpec, taskId: string, data: Partial<Task>) => Promise<ServiceResult>
  deleteTask: (project: ProjectSpec, taskId: string) => Promise<ServiceResult>
  getFeature: (project: ProjectSpec, featureId: string) => Promise<Feature | undefined>
  addFeature: (project: ProjectSpec, taskId: string, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
  updateFeature: (project: ProjectSpec, taskId: string, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
  deleteFeature: (project: ProjectSpec, taskId: string, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (project: ProjectSpec, taskId: string, payload: ReorderFeaturesPayload) => Promise<ServiceResult>
}

export const tasksService: TasksService = { ...window.tasksService }
