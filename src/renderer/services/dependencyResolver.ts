import type { Feature, ProjectSpec, Task } from 'src/types/tasks';
import { tasksService } from './tasksService';
import { TasksIndexSnapshot } from '../../types/external';

export type ReferenceKind = 'task' | 'feature';

export interface ResolvedTaskRef {
  kind: 'task';
  id: string;
  task: Task;
}

export interface ResolvedFeatureRef {
  kind: 'feature';
  id: string; // "{taskId}.{featureId}"
  taskId: string;
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
    | 'TASK_NOT_FOUND'
    | 'FEATURE_NOT_FOUND';
  message: string;
}

export interface InvalidEdgeRecord {
  from: string; // referrer ref (task or feature)
  to: string; // referenced ref string
  error: InvalidRefError;
}

export interface DependencyResolverIndex {
  project?: ProjectSpec | null;
  tasksById: Record<string, Task>;
  featuresById: Record<string, Feature>; // key: "{taskId}.{featureId}"
  dependentsOf: Record<string, string[]>; // reverse index: key is ref (task or feature), value is list of refs that depend on it
  invalidEdges: InvalidEdgeRecord[]; // broken references encountered while indexing
}

export class DependencyResolver {
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
    const tasksById: Record<string, Task> = { ...snapshot.tasksById };
    const featuresById: Record<string, Feature> = {};
    const dependentsOf: Record<string, string[]> = {};
    const invalidEdges: InvalidEdgeRecord[] = [];

    const addDependent = (targetRef: string, dependentRef: string) => {
      if (!dependentsOf[targetRef]) dependentsOf[targetRef] = [];
      if (!dependentsOf[targetRef].includes(dependentRef)) dependentsOf[targetRef].push(dependentRef);
    };

    // Build feature map first
    for (const taskId in tasksById) {
      const task = tasksById[taskId];
      if (!task) continue;
      for (const feat of task.features || []) {
        const fullId = `${taskId}.${feat.id}`;
        featuresById[fullId] = { ...feat };
      }
    }

    // Build reverse dependencies and collect invalid edges
    for (const taskId in tasksById) {
      const task = tasksById[taskId];
      if (!task) continue;

      const fromTaskRef = taskId;
      for (const dep of task.dependencies || []) {
        const validation = this.validateRef(dep);
        if (!validation.ok) {
          invalidEdges.push({ from: fromTaskRef, to: dep, error: validation.error });
        } else {
          addDependent(dep, fromTaskRef);
        }
      }

      for (const feat of task.features || []) {
        const fromFeatRef = `${taskId}.${feat.id}`;
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

  parseRef(ref: string): { kind: ReferenceKind; taskId: string; featureId?: string } | InvalidRefError {
    if (!ref || !ref.trim()) {
      return { input: ref, code: 'EMPTY', message: 'Empty reference' };
    }
    const parts = ref.split('.');
    if (parts.length < 1 || parts.length > 2 || parts.some(p => !p.trim())) {
      return { input: ref, code: 'BAD_FORMAT', message: 'Reference must be <taskId> or <taskId>.<featureId>' };
    }
    const taskId = parts[0].trim();
    if (parts.length === 1) return { kind: 'task', taskId };
    const featureId = parts[1].trim();
    return { kind: 'feature', taskId, featureId };
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
      featureId: parsed.featureId,
      task,
      feature,
    };
  }

  validateRef(ref: string): { ok: true } | { ok: false; error: InvalidRefError } {
    const resolved = this.resolveRef(ref);
    if ('code' in resolved) return { ok: false, error: resolved };
    return { ok: true };
  }

  getDisplayRef(ref: string): string | null {
    const parsed = this.parseRef(ref);
    if ('code' in parsed) return null;
    if (!this.index.project) return null;
    const taskIndex = this.index.project.taskIdToDisplayIndex[parsed.taskId];
    if (taskIndex === undefined) return null;
    if (parsed.kind === 'task') {
      return `${taskIndex}`;
    }
    const task = this.index.tasksById[parsed.taskId];
    if (!task) return null;
    const featureIndex = task.featureIdToDisplayIndex[parsed.featureId!];
    if (featureIndex === undefined) return null;
    return `${taskIndex}.${featureIndex}`;
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
    for (const [taskId, task] of Object.entries(this.index.tasksById)) {
      const taskRef = taskId;
      graph.set(taskRef, []);
      for (const dep of task.dependencies || []) {
        if (this.validateRef(dep).ok) addEdge(taskRef, dep);
      }

      for (const feat of task.features || []) {
        const featRef = `${taskId}.${feat.id}`;
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

    for (const [taskId, task] of Object.entries(this.index.tasksById)) {
      if (task.title.toLowerCase().includes(q)) {
        const display = this.getDisplayRef(taskId) ?? taskId;
        results.push({ ref: taskId, kind: 'task', title: task.title, subtitle: `Task #${display}` });
      }
      for (const feat of task.features || []) {
        const ref = `${taskId}.${feat.id}`;
        if (feat.title.toLowerCase().includes(q)) {
          const display = this.getDisplayRef(ref) ?? ref;
          results.push({ ref, kind: 'feature', title: feat.title, subtitle: `Feature #${display}` });
        }
      }
      if (results.length >= limit) break;
    }

    return results.slice(0, limit);
  }
}

export const dependencyResolver = DependencyResolver.getInstance();
