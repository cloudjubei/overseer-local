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
  dependencies?: string[];
  rejection?: string;
}

export interface Task {
  id: number;
  status: Status;
  title: string;
  description: string;
  features: Feature[];
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
