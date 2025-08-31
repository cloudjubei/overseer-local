import type { Feature, ProjectSpec, Task } from 'src/types/tasks'
import { ServiceResult } from './serviceResult';

export type ReferenceKind = 'task' | 'feature';

export interface ResolvedTaskRef {
  kind: 'task';
  id: string;
  task: Task;
}

export interface ResolvedFeatureRef {
  kind: 'feature';
  id: string; // "{taskId}.{featureId}" || "{taskId}"
  taskId: number;
  featureId: string;
  task: Task;
  feature: Feature;
}

export type ResolvedRef = ResolvedTaskRef | ResolvedFeatureRef;

export interface InvalidRefError {
  input: string;
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
  listTasks: (project: ProjectSpec) => Task[]
  getTask: (project: ProjectSpec, taskId: string) => Task | undefined
  createTask: (project: ProjectSpec, task: TaskCreateInput) => Promise<ServiceResult>
  updateTask: (project: ProjectSpec, taskId: string, data: Partial<Task>) => Promise<ServiceResult>
  deleteTask: (project: ProjectSpec, taskId: string) => Promise<ServiceResult>
  getFeature: (project: ProjectSpec, featureId: string) => Feature | undefined
  addFeature: (project: ProjectSpec, taskId: string, feature: Omit<Feature, 'id'> | Partial<Feature>) => Promise<ServiceResult>
  updateFeature: (project: ProjectSpec, taskId: string, featureId: string, data: Partial<Feature>) => Promise<ServiceResult>
  deleteFeature: (project: ProjectSpec, taskId: string, featureId: string) => Promise<ServiceResult>
  reorderFeatures: (project: ProjectSpec, taskId: string, payload: ReorderFeaturesPayload) => Promise<ServiceResult>

  getReferencesOutbound: (project: ProjectSpec, reference: string) => ResolvedRef[]
  getReferencesInbound: (project: ProjectSpec, reference: string) => ResolvedRef[]
  validateReference: (project: ProjectSpec, reference: string) => ServiceResult
  validateReferences: (project: ProjectSpec, reference: string | null, proposed: string[]) => (ResolvedRef | InvalidRefError)[]
  searchReferences: (project: ProjectSpec, query: string, limit?: number) => ResolvedRef[]
}

export const tasksService: TasksService = { ...window.tasksService }
