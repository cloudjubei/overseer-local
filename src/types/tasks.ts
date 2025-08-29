/**
 * Task schema TypeScript interfaces
 *
 * Source of truth: docs/tasks/task_format.py
 * This file mirrors the Python TypedDict schema for use in the TypeScript app.
 */

export type Status = 
  | "+" // Done
  | "~" // In Progress
  | "-" // Pending
  | "?" // Blocked
  | "="; // Deferred

export interface Feature {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan: string;
  context: string[];
  acceptance: string[];
  dependencies?: string[]; // ["{task_id}.{feature_id}","{task_id}"]
  rejection?: string;
}

export interface Task {
  id: number;
  status: Status;
  title: string;
  description: string;
  features: Feature[];
  dependencies?: string[];// ["{task_id}.{feature_id}","{task_id}"]
  rejection?: string;
}

export interface ProjectRequirement {
  id: number;
  status: Status;
  description: string;
  tasks: number[];
}

export interface ProjectSpec {
  id: string;
  title: string;
  description: string;
  path: string;
  repo_url: string;
  requirements: ProjectRequirement[];
}

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

export interface InvalidEdgeRecord {
  from: string; // referrer ref (task or feature)
  to: string; // referenced ref string
  error: InvalidRefError;
}

export interface DependencyResolverIndex {
  project?: ProjectSpec | null;
  tasksById: Record<number, Task>;
  featuresById: Record<string, Feature>; // key: "{taskId}.{featureId}"
  dependentsOf: Record<string, string[]>; // reverse index: key is ref (task or feature), value is list of refs that depend on it
  invalidEdges: InvalidEdgeRecord[]; // broken references encountered while indexing
}
