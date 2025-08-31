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
  initDependencies: (project?: ProjectSpec | null) => Promise<DependencyResolverIndex>
  setProject: (project: ProjectSpec | null) => void
  onDependenciesUpdate: (cb: (idx: DependencyResolverIndex) => void) => () => void
  getDependencyIndex: () => DependencyResolverIndex
  resolveRef: (ref: string) => ResolvedRef | InvalidRefError
  validateRef: (ref: string) => { ok: true } | { ok: false; error: InvalidRefError }
  validateDependencyList: (contextRef: string | null, proposed: string[]) => { ok: boolean; message?: string; duplicates?: string[]; invalid?: InvalidRefError[]; cycles?: { exists: boolean } }
  getDependents: (ref: string) => string[]
  search: (query: string, limit?: number) => { ref: string; kind: ReferenceKind; title: string; subtitle?: string }[]
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
  initDependencies: (project) => resolver.init(taskService, project),
  setProject: (project) => resolver.setProject(project),
  onDependenciesUpdate: (cb) => resolver.onUpdate(cb),
  getDependencyIndex: () => resolver.getIndex(),
  resolveRef: (ref) => resolver.resolveRef(ref),
  validateRef: (ref) => resolver.validateRef(ref),
  validateDependencyList: (contextRef, proposed) => resolver.validateDependencyList(contextRef, proposed),
  getDependents: (ref) => resolver.getDependents(ref),
  search: (query, limit = 50) => resolver.search(query, limit),
}
