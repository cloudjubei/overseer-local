/*
  Usage: ts-node scripts/alter_dates.ts <tasks_dir> <project_json_path>
  - tasks_dir: path to the tasks folder (e.g., .tasks)
  - project_json_path: path to a project.json implementing ProjectSpec (e.g., .projects/main.json)

  Behavior:
  - Collect all features with completedAt across all task.json files in tasks_dir.
  - Sort those features by the task display index from project.taskIdToDisplayIndex (descending).
  - Starting from the highest display index, assign new completedAt values so that each subsequent feature is offset back in time by a random amount between 10 minutes and 2 hours.
  - Update task files with new feature completedAt values.
  - For each task: if all its features are completed, set task.completedAt to the latest of its feature completedAt timestamps.
*/

import fs from 'fs';
import path from 'path';

interface FeatureSpec {
  id: string;
  status?: string;
  title?: string;
  description?: string;
  plan?: string;
  context?: string[];
  acceptance?: string[];
  createdAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
}

interface TaskSpec {
  id: string;
  status?: string;
  title?: string;
  description?: string;
  features: FeatureSpec[];
  featureIdToDisplayIndex?: Record<string, number>;
  createdAt?: string;
  completedAt?: string | null;
  updatedAt?: string;
}

interface ProjectSpec {
  id: string;
  title?: string;
  description?: string;
  path?: string;
  repo_url?: string;
  requirements?: unknown[];
  taskIdToDisplayIndex: Record<string, number>;
  metadata?: Record<string, unknown>;
}

function readJsonFile<T = any>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

function writeJsonFile(filePath: string, data: any) {
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listTaskJsonFiles(tasksDir: string): string[] {
  if (!isDirectory(tasksDir)) return [];
  const entries = fs.readdirSync(tasksDir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(tasksDir, entry);
    if (isDirectory(full)) {
      const taskJson = path.join(full, 'task.json');
      if (fs.existsSync(taskJson)) files.push(taskJson);
    } else if (entry === 'task.json') {
      // also allow direct file
      files.push(full);
    }
  }
  return files;
}

function randInt(minInclusive: number, maxInclusive: number): number {
  const min = Math.ceil(minInclusive);
  const max = Math.floor(maxInclusive);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function main() {
  const [, , tasksDirArg, projectJsonArg] = process.argv;
  if (!tasksDirArg || !projectJsonArg) {
    console.error('Usage: ts-node scripts/alter_dates.ts <tasks_dir> <project_json_path>');
    process.exit(1);
  }

  const tasksDir = path.resolve(process.cwd(), tasksDirArg);
  const projectJsonPath = path.resolve(process.cwd(), projectJsonArg);

  if (!fs.existsSync(tasksDir)) {
    console.error(`Tasks directory does not exist: ${tasksDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(projectJsonPath)) {
    console.error(`Project JSON does not exist: ${projectJsonPath}`);
    process.exit(1);
  }

  const project = readJsonFile<ProjectSpec>(projectJsonPath);
  const taskDisplayIndex = project.taskIdToDisplayIndex || {};

  const taskFiles = listTaskJsonFiles(tasksDir);
  if (taskFiles.length === 0) {
    console.log('No task.json files found. Nothing to do.');
    return;
  }

  type FeatureContext = {
    taskId: string;
    taskFile: string;
    featureId: string;
    originalCompletedAt: string; // ISO
    displayIndex: number; // from project mapping
    withinTaskIndex: number; // order within task
  };

  const completedFeatures: FeatureContext[] = [];

  for (const taskFile of taskFiles) {
    try {
      const task = readJsonFile<TaskSpec>(taskFile);
      const tId = task.id;
      const dIndex = taskDisplayIndex[tId];
      // Skip tasks that are not in the display index mapping
      if (typeof dIndex !== 'number') continue;

      if (Array.isArray(task.features)) {
        task.features.forEach((f, idx) => {
          if (f && f.completedAt) {
            completedFeatures.push({
              taskId: tId,
              taskFile,
              featureId: f.id,
              originalCompletedAt: f.completedAt,
              displayIndex: dIndex,
              withinTaskIndex: idx,
            });
          }
        });
      }
    } catch (err) {
      console.warn(`Skipping unreadable task file ${taskFile}:`, err);
    }
  }

  if (completedFeatures.length === 0) {
    console.log('No completed features found. Nothing to do.');
    return;
  }

  // Sort by task display index (descending). For tie-breakers, use original completedAt desc, then featureId.
  completedFeatures.sort((a, b) => {
    if (a.displayIndex !== b.displayIndex) return b.displayIndex - a.displayIndex;
    const tA = Date.parse(a.originalCompletedAt);
    const tB = Date.parse(b.originalCompletedAt);
    if (!isNaN(tA) && !isNaN(tB) && tA !== tB) return tB - tA;
    return a.featureId.localeCompare(b.featureId);
  });

  // Base time = latest original completedAt across all features
  const baseMs = completedFeatures.reduce((max, f) => {
    const ms = Date.parse(f.originalCompletedAt);
    return isNaN(ms) ? max : Math.max(max, ms);
  }, 0);
  const defaultBase = baseMs > 0 ? baseMs : Date.now();

  // Assign new completedAt values by walking the sorted list, offsetting each next feature back in time by 10-120 minutes.
  const MIN_DELTA_MS = 10 * 60 * 1000; // 10 minutes
  const MAX_DELTA_MS = 2 * 60 * 60 * 1000; // 2 hours

  const newCompletedAtByFeatureId = new Map<string, string>();
  let currentMs = defaultBase;
  for (let i = 0; i < completedFeatures.length; i++) {
    const f = completedFeatures[i];
    if (i === 0) {
      // first item uses base time
      newCompletedAtByFeatureId.set(f.featureId, new Date(currentMs).toISOString());
    } else {
      const delta = randInt(MIN_DELTA_MS, MAX_DELTA_MS);
      currentMs -= delta;
      newCompletedAtByFeatureId.set(f.featureId, new Date(currentMs).toISOString());
    }
  }

  // Update task files
  let updatedTasks = 0;
  let updatedFeatures = 0;

  for (const taskFile of taskFiles) {
    try {
      const task = readJsonFile<TaskSpec>(taskFile);
      if (!Array.isArray(task.features) || task.features.length === 0) continue;

      let taskChanged = false;
      for (const feature of task.features) {
        if (!feature || !feature.id) continue;
        if (newCompletedAtByFeatureId.has(feature.id)) {
          const newIso = newCompletedAtByFeatureId.get(feature.id)!;
          if (feature.completedAt !== newIso) {
            feature.completedAt = newIso;
            taskChanged = true;
            updatedFeatures++;
          }
        }
      }

      // If all features are completed, set task.completedAt to the latest feature completedAt
      const allCompleted = task.features.length > 0 && task.features.every((f) => !!f.completedAt);
      if (allCompleted) {
        const latestMs = task.features.reduce((max, f) => {
          const ms = f.completedAt ? Date.parse(f.completedAt) : NaN;
          return isNaN(ms) ? max : Math.max(max, ms);
        }, 0);
        const latestIso = latestMs > 0 ? new Date(latestMs).toISOString() : null;
        if (latestIso && task.completedAt !== latestIso) {
          task.completedAt = latestIso;
          taskChanged = true;
        }
      }

      if (taskChanged) {
        writeJsonFile(taskFile, task);
        updatedTasks++;
      }
    } catch (err) {
      console.warn(`Failed to update task file ${taskFile}:`, err);
    }
  }

  console.log(
    `Updated ${updatedFeatures} features across ${updatedTasks} task file(s).`
  );
}

if (require.main === module) {
  main();
}
