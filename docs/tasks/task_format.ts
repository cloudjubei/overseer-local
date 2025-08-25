/**
 * TypeScript interfaces mirroring docs/tasks/task_format.py
 *
 * Source of truth: docs/tasks/task_format.py
 * This file provides a TypeScript representation of the same schema for
 * use in TypeScript codebases or documentation tooling.
 */

// Task/Feature status codes
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

// Utility type guards (optional helpers)
export function isStatus(val: unknown): val is Status {
  return val === "+" || val === "~" || val === "-" || val === "?" || val === "=";
}
