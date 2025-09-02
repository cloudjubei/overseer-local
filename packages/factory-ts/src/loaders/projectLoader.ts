import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LoadedProject, LoadedTask, ProjectConfigSchema, TaskDefinitionSchema } from '../domain';
import { ensureDirExists, ensureFileExists, findRootDir, joinAndNormalize, toPosix } from '../utils/path';

function formatZodError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.errors.map((e) => `${e.path.join('.')} ${e.message}`).join('; ');
  }
  return String(err);
}

function ensureReadableJsonPath(filePath: string, label: string): void {
  try {
    ensureFileExists(filePath, label);
  } catch (e) {
    const pp = toPosix(filePath);
    throw new Error(`${label} not found. Expected at: ${pp}. Details: ${String(e)}`);
  }
}

export interface LoaderOptions {
  // Optional explicit monorepo root (contains 'projects' dir). Overrides env.
  rootDir?: string;
}

function resolveRoot(options?: LoaderOptions): string {
  if (options?.rootDir) return options.rootDir;
  return findRootDir(process.cwd());
}

export async function listProjects(options?: LoaderOptions): Promise<string[]> {
  const root = resolveRoot(options);
  const projectsDir = path.join(root, 'projects');
  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => path.basename(e.name, '.json'))
      .sort();
  } catch (e) {
    const msg = `Unable to list projects in ${toPosix(projectsDir)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
}

export async function loadProject(projectId: string, options?: LoaderOptions): Promise<LoadedProject> {
  if (!projectId || !projectId.trim()) throw new Error('projectId is required');
  const root = resolveRoot(options);
  const projectsDir = path.join(root, 'projects');
  ensureDirExists(projectsDir, 'projects directory');
  const projectConfigPath = path.join(projectsDir, `${projectId}.json`);
  ensureReadableJsonPath(projectConfigPath, `Project config for '${projectId}'`);
  let raw: unknown;
  try {
    const buf = await fs.readFile(projectConfigPath, 'utf8');
    raw = JSON.parse(buf);
  } catch (e) {
    const msg = `Failed to read/parse project config JSON at ${toPosix(projectConfigPath)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
  let config;
  try {
    config = ProjectConfigSchema.parse(raw);
  } catch (e) {
    const msg = `Invalid project config at ${toPosix(projectConfigPath)}: ${formatZodError(e)}`;
    throw new Error(msg);
  }
  // Resolve child project root
  const projectRoot = joinAndNormalize(root, config.path);
  try {
    ensureDirExists(projectRoot, `Child project root for '${projectId}'`);
  } catch (e) {
    const msg = `Child project root not found for '${projectId}'. Expected at ${toPosix(projectRoot)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
  const tasksDir = path.join(projectRoot, 'tasks');
  try {
    ensureDirExists(tasksDir, `Tasks directory for project '${projectId}'`);
  } catch (e) {
    const msg = `Tasks directory missing for '${projectId}'. Expected at ${toPosix(tasksDir)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
  return { config, projectRoot, tasksDir, projectConfigPath };
}

export async function listTasks(projectId: string, options?: LoaderOptions): Promise<string[]> {
  const project = await loadProject(projectId, options);
  try {
    const entries = await fs.readdir(project.tasksDir, { withFileTypes: true });
    const taskDirs = entries.filter((e) => e.isDirectory());
    const taskIds: string[] = [];
    for (const dirent of taskDirs) {
      // Validate that task.json exists inside the folder
      const taskDir = path.join(project.tasksDir, dirent.name);
      const taskJson = path.join(taskDir, 'task.json');
      if (fssync.existsSync(taskJson) && fssync.statSync(taskJson).isFile()) {
        taskIds.push(dirent.name);
      }
    }
    taskIds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return taskIds;
  } catch (e) {
    const msg = `Unable to list tasks for '${projectId}' in ${toPosix(project.tasksDir)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
}

export async function loadTask(projectId: string, taskId: string | number, options?: LoaderOptions): Promise<LoadedTask> {
  const tId = String(taskId);
  if (!tId.trim()) throw new Error('taskId is required');
  const project = await loadProject(projectId, options);
  const taskDir = path.join(project.tasksDir, tId);
  try {
    ensureDirExists(taskDir, `Task directory '${tId}' for project '${projectId}'`);
  } catch (e) {
    const msg = `Task directory not found for '${projectId}:${tId}'. Expected at ${toPosix(taskDir)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
  const taskPath = path.join(taskDir, 'task.json');
  ensureReadableJsonPath(taskPath, `Task definition for '${projectId}:${tId}'`);
  let raw: unknown;
  try {
    const buf = await fs.readFile(taskPath, 'utf8');
    raw = JSON.parse(buf);
  } catch (e) {
    const msg = `Failed to read/parse task JSON at ${toPosix(taskPath)}. Details: ${String(e)}`;
    throw new Error(msg);
  }
  let task;
  try {
    task = TaskDefinitionSchema.parse(raw);
  } catch (e) {
    const msg = `Invalid task definition at ${toPosix(taskPath)}: ${formatZodError(e)}`;
    throw new Error(msg);
  }
  return { task, taskPath, taskId: task.id };
}
