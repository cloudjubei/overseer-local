import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import type { Status, Feature, Task } from './types.js';
import type { GitManager } from './gitManager.js';

// Stable framework root (monorepo/app root) captured at module load.
// This should never be mutated by per-run operations.
const FRAMEWORK_ROOT = path.resolve(process.cwd());

// Mutable project root used for file tools operating within a specific workspace copy.
let PROJECT_ROOT = FRAMEWORK_ROOT;
const TASKS_DIR_NAME = 'tasks';

function setProjectRoot(p: string) { PROJECT_ROOT = path.resolve(p || FRAMEWORK_ROOT); }
function getProjectRoot() { return PROJECT_ROOT; }

function tasksDir() { return path.join(PROJECT_ROOT, TASKS_DIR_NAME); }
function taskDir(taskId: string) { return path.join(tasksDir(), taskId); }
function taskPath(taskId: string) { return path.join(taskDir(taskId), 'task.json'); }
function testPath(taskId: string, featureId: string) { return path.join(taskDir(taskId), 'tests', `test_${taskId}_${featureId}.py`); }

const PROJECTS_DIR_NAME = 'projects';
// Project configs must always be read from the stable framework root, not the mutable project root.
function projectsDirStable() { return path.join(FRAMEWORK_ROOT, PROJECTS_DIR_NAME); }
function projectPathStable(projectId: string) { return path.join(projectsDirStable(), `${projectId}.json`); }

async function ensureDir(p: string) { await fsp.mkdir(p, { recursive: true }); }

async function getProjectDir(projectId: string): Promise<string> {
  // Read the project config from the stable framework root so multiple runs do not depend on temporary workspace state.
  const p = projectPathStable(projectId);
  const raw = await fsp.readFile(p, 'utf8');
  const project = JSON.parse(raw);
  // project.path is assumed to be relative to the projects dir or the repo root; resolve from FRAMEWORK_ROOT
  return path.join(FRAMEWORK_ROOT, PROJECTS_DIR_NAME, project.path)
}

async function getTask(taskId: string): Promise<Task> {
  const p = taskPath(taskId);
  const raw = await fsp.readFile(p, 'utf8');
  return JSON.parse(raw);
}

async function saveTask(task: Task): Promise<void> {
  const p = taskPath(task.id);
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, JSON.stringify(task, null, 2), 'utf8');
}

async function updateTaskStatus(taskId: string, status: Status): Promise<Task> {
  const t = await getTask(taskId);
  t.status = status;
  await saveTask(t);
  return t;
}

// File utilities (sandboxed under project root)
function isWithinRoot(abs: string) {
  const root = getProjectRoot();
  const normRoot = path.resolve(root) + path.sep;
  const normAbs = path.resolve(abs) + path.sep;
  return normAbs.startsWith(normRoot) || path.resolve(abs) === path.resolve(root);
}

async function readFiles(pathsRel: string[]): Promise<string> {
  const result: Record<string, any> = {};
  for (const rel of pathsRel) {
    try {
      const abs = path.resolve(getProjectRoot(), rel);
      if (!isWithinRoot(abs)) { result[rel] = 'SECURITY ERROR: Cannot access path outside project directory.\n'; continue; }
      const st = await fsp.stat(abs).catch(() => null);
      if (!st) { result[rel] = 'Path not found or is not a regular file/directory.'; continue; }
      if (st.isDirectory()) {
        const entries = await fsp.readdir(abs);
        result[rel] = entries;
      } else if (st.isFile()) {
        result[rel] = await fsp.readFile(abs, 'utf8');
      } else {
        result[rel] = 'Path not found or is not a regular file/directory.';
      }
    } catch (e) {
      result[rel] = String(e);
    }
  }
  return JSON.stringify(result, null, 0);
}
async function updateFeatureStatus(taskId: string, featureId: string, status: Status) {
  const t = await getTask(taskId);
  const feature = t.features.find(f => f.id === featureId);
  if (feature) {
    feature.status = status;
    await saveTask(t);
    return feature;
  }
  return undefined;
}

async function blockFeature(taskId: string, featureId: string, reason: string, agentType: string, git: GitManager) {
  const t = await getTask(taskId);
  const feature = t.features.find(f => f.id === featureId);
  if (feature) {
    feature.status = '?';
    feature.rejection = `Blocked: ${reason}`;
    await saveTask(t);
  }
  const title = feature?.title ?? '';
  let msg: string;
  if (agentType === 'developer') msg = `BLOCKED feat: Complete feature ${featureId} - ${title}`;
  else if (agentType === 'planner') msg = `BLOCKED plan: Add plan for feature ${featureId} - ${title}`;
  else if (agentType === 'tester') msg = `BLOCKED test: Add tests for feature ${featureId} - ${title}`;
  else if (agentType === 'contexter') msg = `BLOCKED context: Set context for feature ${featureId} - ${title}`;
  else throw new Error(`Unknown agent_type '${agentType}' called block_feature.`);

  try { await git.stageAll() } catch (e) { console.warn('Warning: Could not stage files.', e); }
  try { await git.commit(msg); console.log(`Committed changes with message: '${msg}'`); } catch (e) { console.warn('Warning: Git commit failed.', e); }
  try { await git.push(); } catch (e) { console.warn('Could not push:', e); }

  console.log(`Feature ${featureId} blocked. Reason: ${reason}`);
  return feature;
}

async function blockTask(taskId: string, reason: string, agentType: string, git: GitManager) {
  const t = await getTask(taskId);
  t.status = '?';
  t.rejection = `Blocked: ${reason}`;
  await saveTask(t);
  const msg = `BLOCKED task: ${t.id} - ${t.title}`;
  try { await git.stageAll() } catch (e) { console.warn('Warning: Could not stage files.', e); }
  try { await git.commit(msg); console.log(`Committed changes with message: '${msg}'`); } catch (e) { console.warn('Warning: Git commit failed.', e); }
  try { await git.push(); } catch (e) { console.warn('Could not push:', e); }
  console.log(`Task ${taskId} blocked. Reason: ${reason}`);
  return t;
}

async function checkAndUpdateTaskCompletion(taskId: string) {
  const t = await getTask(taskId);
  const allDone = (t.features || []).every(f => f.status === '+');
  if (allDone) {
    console.log(`All features for task ${taskId} are complete. Updating task status to '+'.`);
    await updateTaskStatus(taskId, '+');
  }
}

async function finishFeature(taskId: string, featureId: string, agentType: string, git: GitManager) {
  const t = await getTask(taskId);
  const feature = t.features.find(f => f.id === featureId);
  const title = feature?.title ?? '';
  let msg: string;
  if (agentType === 'developer') {
    msg = `feat: Complete feature ${featureId} - ${title}`;
    await updateFeatureStatus(taskId, featureId, '+');
    await checkAndUpdateTaskCompletion(taskId);
  } else if (agentType === 'planner') {
    msg = `plan: Add plan for feature ${featureId} - ${title}`;
    await updateFeatureStatus(taskId, featureId, '-');
  } else if (agentType === 'tester') {
    msg = `test: Add tests for feature ${featureId} - ${title}`;
    await updateFeatureStatus(taskId, featureId, '-');
  } else if (agentType === 'contexter') {
    msg = `context: Set context for feature ${featureId} - ${title}`;
    await updateFeatureStatus(taskId, featureId, '-');
  } else {
    throw new Error(`Unknown agent_type '${agentType}' called finish_feature.`);
  }
  try { await git.stageAll() } catch (e) { console.warn('Warning: Could not stage files.', e); }
  try { await git.commit(msg); console.log(`Committed changes with message: '${msg}'`); } catch (e) { console.warn('Warning: Git commit failed.', e); }
  try { await git.push(); } catch (e) { console.warn('Could not push:', e); }
  return `Feature ${featureId} finished by ${agentType} and changes committed.`;
}

async function finishSpec(taskId: string, agentType: string, git: GitManager) {
  if (agentType !== 'speccer') throw new Error(`Unknown agent_type '${agentType}' called finish_spec.`);
  try { await git.stageAll() } catch (e) { console.warn('Warning: Could not stage files.', e); }
  const msg = `spec: Added spec for task: ${taskId}`;
  try { await git.commit(msg); console.log(`Committed changes with message: '${msg}'`); } catch (e) { console.warn('Warning: Git commit failed.', e); }
  try { await git.push(); } catch (e) { console.warn('Could not push:', e); }
  return `Task ${taskId} finished spec by ${agentType} and changes committed.`;
}

// Tester tools
async function getTest(taskId: string, featureId: string) {
  const p = testPath(taskId, featureId);
  try { return await fsp.readFile(p, 'utf8'); } catch { return `Test file not found at ${p}`; }
}

async function updateAcceptanceCriteria(taskId: string, featureId: string, criteria: string[]) {
  const t = await getTask(taskId);
  const f = t.features.find(x => x.id === featureId);
  if (f) { f.acceptance = criteria; await saveTask(t); return f; }
  return undefined;
}

async function updateTest(taskId: string, featureId: string, test: string) {
  const p = testPath(taskId, featureId);
  await ensureDir(path.dirname(p));
  await fsp.writeFile(p, test, 'utf8');
  return `Test file updated at ${p}`;
}

async function deleteTest(taskId: string, featureId: string) {
  const p = testPath(taskId, featureId);
  try { await fsp.unlink(p); return `Test file ${p} deleted.`; } catch { return `Test file ${p} not found.`; }
}

async function runTest(taskId: string, featureId: string) {
  const p = testPath(taskId, featureId);
  if (!fs.existsSync(p)) return 'FAIL: Test file not found.';
  const { spawn } = await import('node:child_process');
  return await new Promise<string>((resolve) => {
    const proc = spawn('python3', [p], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 30000);
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(`PASS: Test executed successfully.\nOutput:\n${stdout}`);
      else resolve(`FAIL: Test failed with exit code ${code}.\nStderr:\n${stderr}\nStdout:\n${stdout}`);
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      resolve(`FAIL: An unexpected error occurred while running the test: ${e}`);
    });
  });
}

// Orchestrator helpers
function findNextAvailableFeature(task: Task, excludeIds: Set<string> = new Set(), ignoreDependencies = false): Feature | undefined {
  const features = (task.features || []).slice();
  if (features.length === 0) return undefined;

  // Create an index mapping using featureIdToDisplayIndex; fallback to array order
  const displayIndex: Record<string, number> = {};
  const map = (task as any).featureIdToDisplayIndex as Record<string, number> | undefined;
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const idx = map?.[f.id];
    displayIndex[f.id] = typeof idx === 'number' ? idx : (i + 1); // 1-based fallback
  }

  // Sort features by display index ascending
  features.sort((a, b) => {
    const ai = displayIndex[a.id] ?? Number.MAX_SAFE_INTEGER;
    const bi = displayIndex[b.id] ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    // Stable fallback using original array order if indexes equal/missing
    return 0;
  });

  const completed = new Set(features.filter(f => f.status === '+').map(f => f.id));
  for (const f of features) {
    if (excludeIds.has(f.id)) continue;
    if (f.status === '-') {
      const deps = f.blockers || [];
      if (ignoreDependencies || deps.every(d => completed.has(d))) return f;
    }
  }
  return undefined;
}

function uuidv4() {
  // Simple UUID v4 generator for local use
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createFeature(taskId: string, title: string, description: string): Promise<Feature> {
  const t = await getTask(taskId);
  const id = uuidv4();
  const newFeature: Feature = {
    id,
    status: '-',
    title,
    description,
    plan: '',
    context: [],
    acceptance: [],
  };
  t.features = t.features || [];
  t.features.push(newFeature);
  t.featureIdToDisplayIndex = t.featureIdToDisplayIndex || {};
  t.featureIdToDisplayIndex[id] = t.features.length;
  await saveTask(t);
  console.log(`New feature '${id}' created in task ${taskId}.`);
  return newFeature;
}

async function updateFeaturePlan(taskId: string, featureId: string, plan: any) {
  const planStr = Array.isArray(plan) ? plan.map(String).join('\n') : (typeof plan === 'string' ? plan : String(plan));
  const t = await getTask(taskId);
  const f = t.features.find(x => x.id === featureId);
  if (f) { f.plan = planStr; await saveTask(t); return f; }
  return undefined;
}

async function updateFeatureContext(taskId: string, featureId: string, context: string[]) {
  const t = await getTask(taskId);
  const f = t.features.find(x => x.id === featureId);
  if (f) { f.context = context; await saveTask(t); return f; }
  return undefined;
}

export const taskUtils = {
  // project
  setProjectRoot,
  // task io
  getTask,
  saveTask,
  updateTaskStatus,
  // feature status
  updateFeatureStatus,
  blockFeature,
  blockTask,
  finishFeature,
  finishSpec,
  // tester tools
  getTest,
  updateAcceptanceCriteria,
  updateTest,
  deleteTest,
  runTest,
  // orchestrator helpers
  getProjectDir,
  findNextAvailableFeature,
  createFeature,
  updateFeaturePlan,
  updateFeatureContext,
};

export type TaskUtils = typeof taskUtils;
