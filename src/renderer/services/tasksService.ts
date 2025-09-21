import type {
  Feature,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  Status,
  Task,
  TaskCreateInput,
  TaskEditInput,
} from 'thefactory-tools'

export const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}
export type ReferenceKind = 'task' | 'feature'

export interface ResolvedTaskRef {
  kind: 'task'
  id: string
  taskId: string
  task: Task
  display: string
}

export interface ResolvedFeatureRef {
  kind: 'feature'
  id: string
  taskId: string
  featureId: string
  task: Task
  feature: Feature
  display: string
}

export type ResolvedRef = ResolvedTaskRef | ResolvedFeatureRef

export interface InvalidRefError {
  id: string
  code: 'EMPTY' | 'BAD_FORMAT' | 'BAD_TASK_ID' | 'TASK_NOT_FOUND' | 'FEATURE_NOT_FOUND'
  message: string
}

export type TasksService = {
  subscribe: (callback: () => void) => () => void
  listTasks: (projectId: string) => Promise<Task[]>
  getTask: (projectId: string, taskId: string) => Promise<Task | undefined>
  createTask: (projectId: string, input: TaskCreateInput) => Promise<Task>
  updateTask: (projectId: string, taskId: string, patch: TaskEditInput) => Promise<Task | undefined>
  deleteTask: (projectId: string, taskId: string) => Promise<void>
  getFeature: (projectId: string, featureId: string) => Promise<Feature | undefined>
  addFeature: (
    projectId: string,
    taskId: string,
    input: FeatureCreateInput,
  ) => Promise<Task | undefined>
  updateFeature: (
    projectId: string,
    taskId: string,
    featureId: string,
    patch: FeatureEditInput,
  ) => Promise<Task | undefined>
  deleteFeature: (projectId: string, taskId: string, featureId: string) => Promise<Task | undefined>
  reorderFeatures: (
    projectId: string,
    taskId: string,
    payload: ReorderPayload,
  ) => Promise<Task | undefined>
}

export const tasksService: TasksService = { ...window.tasksService }
