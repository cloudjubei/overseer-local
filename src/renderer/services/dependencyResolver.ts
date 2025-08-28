import type { Feature, ProjectSpec, Task } from 'src/types/tasks';
import { tasksService } from './tasksService';
import type { TasksIndexSnapshot } from '../../types/external';

export type ReferenceKind = 'task' | 'feature';

export interface ResolvedTaskRef {
  kind: 'task';
  id: number;
  task: Task;
}

export interface ResolvedFeatureRef {
  kind: 'feature';
  id: string; // "{taskId}.{featureId}"
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

export interface DependencyResolverIndex {
  project?: ProjectSpec | null;
  tasksById: Record<number, Task>;
  featuresById: Record<string, Feature>; // key: "{taskId}.{featureId}"
  dependentsOf: Record<string, string[]>; // reverse index: key is ref (task or feature), value is list of refs that depend on it
}

export class DependencyResolver {
  private static instance: DependencyResolver | null = null;
  private index: DependencyResolverIndex = {
    project: null,
    tasksById: {},
    featuresById: {},
    dependentsOf: {},
  };
  private ready = false;
  private unsubscribeTasks?: () => void;
  private listeners: Set<(idx: DependencyResolverIndex) => void> = new Set();

  static getInstance() {
    if (!DependencyResolver.instance) {
      DependencyResolver.instance = new DependencyResolver();
    }
    return DependencyResolver.instance;
  }

  onUpdate(cb: (idx: DependencyResolverIndex) => void) {
    this.listeners.add(cb);
    if (this.ready) cb(this.index);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb(this.index);
  }

  async init(project?: ProjectSpec | null) {
    // Attach tasks index subscription and build our index once
    if (!this.unsubscribeTasks) {
      this.unsubscribeTasks = tasksService.onUpdate((snapshot) => {
        this.rebuild(snapshot, this.index.project ?? null);
      });
    }
    const snapshot = await tasksService.getSnapshot();
    this.rebuild(snapshot, project ?? this.index.project ?? null);
    this.ready = true;
    return this.index;
  }

  setProject(project: ProjectSpec | null) {
    // Allows injecting current project spec from elsewhere in app
    this.index.project = project;
    if (this.ready) this.notify();
  }

  getIndex(): DependencyResolverIndex {
    return this.index;
  }

  private rebuild(snapshot: TasksIndexSnapshot, project: ProjectSpec | null) {
    const tasksById: Record<number, Task> = { ...snapshot.tasksById };
    const featuresById: Record<string, Feature> = {};
    const dependentsOf: Record<string, string[]> = {};

    const addDependent = (targetRef: string, dependentRef: string) => {
      if (!dependentsOf[targetRef]) dependentsOf[targetRef] = [];
      if (!dependentsOf[targetRef].includes(dependentRef)) dependentsOf[targetRef].push(dependentRef);
    };

    // Build feature map and reverse dependencies
    for (const taskIdStr of Object.keys(tasksById)) {
      const taskId = Number(taskIdStr);
      const task = tasksById[taskId];
      if (!task) continue;

      // Map features
      for (const feat of task.features || []) {
        featuresById[`${taskId}.${feat.id}`] = { ...feat };
      }

      // Reverse from task-level dependencies
      for (const dep of task.dependencies || []) {
        addDependent(dep, String(task.id));
      }

      // Reverse from feature-level dependencies
      for (const feat of task.features || []) {
        if (!feat.dependencies) continue;
        for (const dep of feat.dependencies) {
          addDependent(dep, `${taskId}.${feat.id}`);
        }
      }
    }

    this.index = { project, tasksById, featuresById, dependentsOf };
    if (this.ready) this.notify();
  }

  parseRef(ref: string): { kind: ReferenceKind; taskId: number; featureId?: string } | InvalidRefError {
    if (!ref || !ref.trim()) {
      return { input: ref, code: 'EMPTY', message: 'Empty reference' };
    }
    const parts = ref.split('.');
    if (parts.length > 2 || parts.length < 1) {
      return { input: ref, code: 'BAD_FORMAT', message: 'Reference must be #<taskId> or #<taskId>.<featureId>' };
    }
    const taskId = Number(parts[0]);
    if (!Number.isInteger(taskId)) {
      return { input: ref, code: 'BAD_TASK_ID', message: 'Task id must be an integer' };
    }
    if (parts.length === 1) return { kind: 'task', taskId } as const;
    return { kind: 'feature', taskId, featureId: parts[1] } as const;
  }

  resolveRef(ref: string): ResolvedRef | InvalidRefError {
    const parsed = this.parseRef(ref);
    if ('code' in parsed) return parsed;

    if (parsed.kind === 'task') {
      const task = this.index.tasksById[parsed.taskId];
      if (!task) {
        return { input: ref, code: 'TASK_NOT_FOUND', message: `Task ${parsed.taskId} not found` };
      }
      return { kind: 'task', id: parsed.taskId, task };
    }

    const task = this.index.tasksById[parsed.taskId];
    if (!task) {
      return { input: ref, code: 'TASK_NOT_FOUND', message: `Task ${parsed.taskId} not found` };
    }
    const key = `${parsed.taskId}.${parsed.featureId}`;
    const feature = this.index.featuresById[key];
    if (!feature) {
      return { input: ref, code: 'FEATURE_NOT_FOUND', message: `Feature ${key} not found` };
    }
    return {
      kind: 'feature',
      id: key,
      taskId: parsed.taskId,
      featureId: parsed.featureId!,
      task,
      feature,
    };
  }

  validateRef(ref: string): { ok: true } | { ok: false; error: InvalidRefError } {
    const resolved = this.resolveRef(ref);
    if ('code' in resolved) return { ok: false, error: resolved };
    return { ok: true };
  }

  // All inbound dependents (what depends on the given ref)
  getDependents(ref: string): string[] {
    return this.index.dependentsOf[ref] || [];
  }

  // Quick search across tasks & features by title; useful for pickers/autocomplete
  search(query: string, limit = 50): { ref: string; kind: ReferenceKind; title: string; subtitle?: string }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: { ref: string; kind: ReferenceKind; title: string; subtitle?: string }[] = [];

    for (const [idStr, task] of Object.entries(this.index.tasksById)) {
      const taskId = Number(idStr);
      if (task.title.toLowerCase().includes(q)) {
        results.push({ ref: `${taskId}`, kind: 'task', title: task.title, subtitle: `Task #${taskId}` });
      }
      for (const feat of task.features || []) {
        const ref = `${taskId}.${feat.id}`;
        if (feat.title.toLowerCase().includes(q)) {
          results.push({ ref, kind: 'feature', title: feat.title, subtitle: `Feature #${ref}` });
        }
      }
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }
}

export const dependencyResolver = DependencyResolver.getInstance();
