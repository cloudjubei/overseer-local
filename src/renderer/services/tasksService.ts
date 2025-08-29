import type { Feature, ProjectSpec, Task } from 'src/types/tasks'
import type { TasksIndexSnapshot, ReorderFeaturesPayload, ReorderTasksPayload, ServiceResult } from '../../types/external'
import DependencyResolver, { DependencyResolverIndex, InvalidRefError, ReferenceKind, ResolvedRef } from './dependencyResolver'

export type TaskCreateInput = Pick<Task, 'status' | 'title' | 'description'> & Partial<Pick<Task, 'features' | 'rejection' | 'dependencies'>>

const resolver = DependencyResolver.getInstance();

export type TasksService = {
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

export const tasksService: TasksService = {
  getSnapshot: () => window.tasksService.getSnapshot(),
  onUpdate: (callback) => window.tasksService.subscribe(async () => {
    const snap = await window.tasksService.getSnapshot();
    callback(snap);
  }),
  addTask: (task) => window.tasksService.addTask(task),
  updateTask: (taskId, data) => window.tasksService.updateTask(taskId, data),
  deleteTask: (taskId) => window.tasksService.deleteTask(taskId),
  addFeature: (taskId, feature) => window.tasksService.addFeature(taskId, feature),
  updateFeature: (taskId, featureId, data) => window.tasksService.updateFeature(taskId, featureId, data),
  deleteFeature: (taskId, featureId) => window.tasksService.deleteFeature(taskId, featureId),
  reorderFeatures: (taskId, payload) => window.tasksService.reorderFeatures(taskId, payload),
  reorderTasks: (payload) => window.tasksService.reorderTasks(payload),
  initDependencies: (project) => resolver.init(tasksService, project),
  setProject: (project) => resolver.setProject(project),
  onDependenciesUpdate: (cb) => resolver.onUpdate(cb),
  getDependencyIndex: () => resolver.getIndex(),
  resolveRef: (ref) => resolver.resolveRef(ref),
  validateRef: (ref) => resolver.validateRef(ref),
  validateDependencyList: (contextRef, proposed) => resolver.validateDependencyList(contextRef, proposed),
  getDependents: (ref) => resolver.getDependents(ref),
  search: (query, limit = 50) => resolver.search(query, limit),
}
