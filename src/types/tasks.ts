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

export type DependencyType = 'task' | 'feature';

export interface Dependency {
  type: DependencyType;
  project_id: string;
  task_id: number;
  feature_id?: string;
}

export interface Feature {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan: string;
  context: string[];
  acceptance: string[];
  dependencies?: Dependency[];
  rejection?: string;
}

export interface Task {
  id: number;
  status: Status;
  title: string;
  description: string;
  features: Feature[];
  dependencies?: Dependency[];
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
