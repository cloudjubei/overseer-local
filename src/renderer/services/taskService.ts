import type { Feature, ProjectSpec, Task, ReferenceKind, ResolvedRef, InvalidRefError, DependencyResolverIndex } from 'src/types/tasks'
import type { TasksIndexSnapshot, ReorderFeaturesPayload, ReorderTasksPayload, ServiceResult } from '../../types/external'

class DependencyResolver {
  private static instance: DependencyResolver | null = null;
  private index: DependencyResolverIndex = {
    project: null,
    tasksById: {},
    featuresById: {},
    dependentsOf: {},
    invalidEdges: [],
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
      this.unsubscribeTasks = taskService.onUpdate((snapshot) => {
        this.rebuild(snapshot, this.index.project ?? null);
      });
    }
    const snapshot = await taskService.getSnapshot();
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
    const invalidEdges: InvalidEdgeRecord[] = [];

    const addDependent = (targetRef: string, dependentRef: string) => {
      if (!dependentsOf[targetRef]) dependentsOf[targetRef] = [];
      if (!dependentsOf[targetRef].includes(dependentRef)) dependentsOf[targetRef].push(dependentRef);
    };

    // Build feature map first
    for (const taskIdStr of Object.keys(tasksById)) {
      const taskId = Number(taskIdStr);
      const task = tasksById[taskId];
      if (!task) continue;
      for (const feat of task.features || []) {
        featuresById[`${feat.id}`] = { ...feat };
      }
    }

    // Build reverse dependencies and collect invalid edges
    for (const taskIdStr of Object.keys(tasksById)) {
      const taskId = Number(taskIdStr);
      const task = tasksById[taskId];
      if (!task) continue;

      const fromTaskRef = `${taskId}`;
      for (const dep of task.dependencies || []) {
        const validation = this.validateRef(dep);
        if (!validation.ok) {
          invalidEdges.push({ from: fromTaskRef, to: dep, error: validation.error });
        } else {
          addDependent(dep, fromTaskRef);
        }
      }

      for (const feat of task.features || []) {
        const fromFeatRef = `${feat.id}`;
        for (const dep of feat.dependencies || []) {
          const validation = this.validateRef(dep);
          if (!validation.ok) {
            invalidEdges.push({ from: fromFeatRef, to: dep, error: validation.error });
          } else {
            addDependent(dep, fromFeatRef);
          }
        }
      }
    }

    this.index = { project, tasksById, featuresById, dependentsOf, invalidEdges };
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
    return { kind: 'feature', taskId, featureId: ref } as const;
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
    const key = `${parsed.featureId}`;
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

  // Validate a proposed dependency list for a given context node (task or feature ref)
  // - Checks: duplicates, invalid/broken refs, self-reference, cycle detection.
  validateDependencyList(
    contextRef: string | null,
    proposed: string[]
  ): {
    ok: boolean;
    message?: string;
    duplicates?: string[];
    invalid?: InvalidRefError[];
    cycles?: { exists: boolean };
  } {
    const duplicates: string[] = [];
    const seen = new Set<string>();
    for (const d of proposed) {
      if (seen.has(d)) duplicates.push(d);
      seen.add(d);
    }

    const invalid: InvalidRefError[] = [];
    for (const ref of proposed) {
      const v = this.validateRef(ref);
      if (!v.ok) invalid.push(v.error);
    }

    if (contextRef && proposed.includes(contextRef)) {
      return { ok: false, message: 'Self-dependency is not allowed', duplicates: duplicates.length ? duplicates : undefined, invalid: invalid.length ? invalid : undefined, cycles: { exists: false } };
    }

    if (duplicates.length || invalid.length) {
      const msgParts: string[] = [];
      if (duplicates.length) msgParts.push(`Duplicate dependencies: ${Array.from(new Set(duplicates)).join(', ')}`);
      if (invalid.length) msgParts.push(`Invalid references: ${invalid.map((e) => e.input).join(', ')}`);
      return { ok: false, message: msgParts.join(' | '), duplicates, invalid, cycles: { exists: false } };
    }

    // Cycle detection: Build a graph of valid edges, then set/replace context node edges with proposed.
    type Graph = Map<string, string[]>;
    const graph: Graph = new Map();
    const addEdge = (from: string, to: string) => {
      const arr = graph.get(from) || [];
      arr.push(to);
      graph.set(from, arr);
    };

    // Add all tasks/features and their valid dependencies
    for (const [taskIdStr, task] of Object.entries(this.index.tasksById)) {
      const taskId = Number(taskIdStr);
      const taskRef = `${taskId}`;
      graph.set(taskRef, []);
      for (const dep of task.dependencies || []) {
        if (this.validateRef(dep).ok) addEdge(taskRef, dep);
      }

      for (const feat of task.features || []) {
        const featRef = `${feat.id}`;
        graph.set(featRef, []);
        for (const dep of feat.dependencies || []) {
          if (this.validateRef(dep).ok) addEdge(featRef, dep);
        }
      }
    }

    // If creating a new feature (no contextRef), add a temporary node
    const ctx = contextRef ?? '__new__';
    graph.set(ctx, []);

    // Replace context edges with proposed valid ones
    graph.set(ctx, proposed.filter((r) => this.validateRef(r).ok));

    // DFS to detect cycles
    const visited = new Set<string>();
    const stack = new Set<string>();
    const dfs = (node: string): boolean => {
      visited.add(node);
      stack.add(node);
      const neighbors = graph.get(node) || [];
      for (const n of neighbors) {
        if (!visited.has(n)) {
          if (dfs(n)) return true;
        } else if (stack.has(n)) {
          return true;
        }
      }
      stack.delete(node);
      return false;
    };

    // Run DFS starting from all nodes (cheap; graph is small)
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          return { ok: false, message: 'Dependency cycle detected', cycles: { exists: true } };
        }
      }
    }

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
        const ref = `${feat.id}`;
        if (feat.title.toLowerCase().includes(q)) {
          results.push({ ref, kind: 'feature', title: feat.title, subtitle: `Feature #${ref}` });
        }
      }
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }
}

const resolver = DependencyResolver.getInstance();

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
  initDependencies: (project) => resolver.init(project),
  setProject: (project) => resolver.setProject(project),
  onDependenciesUpdate: (cb) => resolver.onUpdate(cb),
  getDependencyIndex: () => resolver.getIndex(),
  resolveRef: (ref) => resolver.resolveRef(ref),
  validateRef: (ref) => resolver.validateRef(ref),
  validateDependencyList: (contextRef, proposed) => resolver.validateDependencyList(contextRef, proposed),
  getDependents: (ref) => resolver.getDependents(ref),
  search: (query, limit = 50) => resolver.search(query, limit),
}
