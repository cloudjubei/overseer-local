import { z } from 'zod';

// Utilities
const stringOrNumberId = z.union([z.string().min(1), z.number()]).transform((v) => String(v));

// Task schema (child project tasks/{id}/task.json)
export const TaskDefinitionSchema = z.object({
  id: stringOrNumberId,
  title: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.unknown()).optional(),
  // Allow additional fields for forward-compatibility
}).passthrough();

export type TaskDefinition = z.infer<typeof TaskDefinitionSchema> & { id: string };

// Project config schema projects/{projectId}.json
// Minimal, forward-compatible: require id and path; optionally tasks refs
const TaskRefSchema = z.union([
  stringOrNumberId,
  z.object({ id: stringOrNumberId, title: z.string().optional(), description: z.string().optional() }).transform((v) => v.id),
]);

export const ProjectConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  // Path to the child project's root, relative to the superproject root
  path: z.string().min(1),
  tasks: z.array(TaskRefSchema).optional(),
}).passthrough();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// Loaded shapes enriched with resolved paths
export interface LoadedProject {
  config: ProjectConfig;
  // Absolute path to child project root
  projectRoot: string;
  // Absolute path to tasks directory within the child project
  tasksDir: string;
  // Absolute path to the project config JSON file
  projectConfigPath: string;
}

export interface LoadedTask {
  task: TaskDefinition;
  // Absolute path to the task.json
  taskPath: string;
  // The numeric/string folder id for the task (normalized as string)
  taskId: string;
}
