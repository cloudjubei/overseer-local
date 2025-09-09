import fs from 'fs/promises';
import path from 'node:path';
import { validateTask } from '../../..//tasks/TasksValidator.js';

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function mergeTaskFromCommit(localTask, commitTask) {
  const next = { ...localTask };

  // Sync top-level fields when present in commit
  if (typeof commitTask.status === 'string') next.status = commitTask.status;
  if (typeof commitTask.title === 'string' && commitTask.title.trim()) next.title = commitTask.title;
  if (typeof commitTask.description === 'string') next.description = commitTask.description;

  // Merge features by id; only sync known per-feature fields; keep unknown fields intact on local
  const localById = new Map((Array.isArray(localTask.features) ? localTask.features : []).map(f => [f.id, f]));
  const commitFeatures = Array.isArray(commitTask.features) ? commitTask.features : [];

  for (const cf of commitFeatures) {
    if (!cf || typeof cf.id !== 'string') continue;
    const lf = localById.get(cf.id);
    if (!lf) continue; // do not create new local features implicitly; only update existing ones

    const merged = { ...lf };
    if (typeof cf.status === 'string') merged.status = cf.status;
    if (typeof cf.title === 'string' && cf.title.trim()) merged.title = cf.title;
    if (typeof cf.description === 'string') merged.description = cf.description;
    if (Array.isArray(cf.context)) merged.context = cf.context;
    if (Array.isArray(cf.acceptance)) merged.acceptance = cf.acceptance;
    if (Array.isArray(cf.blockers)) merged.blockers = cf.blockers;
    if (typeof cf.rejection !== 'undefined') merged.rejection = cf.rejection;

    localById.set(cf.id, merged);
  }

  // Rebuild features preserving original order using featureIdToDisplayIndex when possible
  const displayIndex = localTask.featureIdToDisplayIndex || {};
  const updatedFeatures = Array.from(localById.values());
  updatedFeatures.sort((a, b) => (displayIndex[a.id] || 0) - (displayIndex[b.id] || 0));
  next.features = updatedFeatures;

  // featureIdToDisplayIndex remains as in local unless commit provided a mapping
  if (commitTask.featureIdToDisplayIndex && typeof commitTask.featureIdToDisplayIndex === 'object') {
    next.featureIdToDisplayIndex = { ...next.featureIdToDisplayIndex, ...commitTask.featureIdToDisplayIndex };
  }

  return next;
}

/**
 * Update the local tasks/<taskId>/task.json using data extracted from a commit's task.json.
 * - Only updates existing task/features; does not create new tasks or features implicitly.
 * - Focuses on syncing statuses and basic metadata.
 *
 * @param {object} options
 * @param {string} options.projectRoot - Root path of the project containing the tasks directory
 * @param {object} options.commitTask - Parsed task.json object from the commit
 * @returns {Promise<{ ok: true, path: string, updated: boolean } | { ok: false, error: string }>}
 */
export async function updateLocalTaskFromCommit({ projectRoot, commitTask }) {
  try {
    if (!commitTask || typeof commitTask !== 'object') {
      return { ok: false, error: 'commitTask must be an object' };
    }
    const taskId = commitTask.id;
    if (!taskId || typeof taskId !== 'string') {
      return { ok: false, error: 'commitTask.id is required' };
    }

    const taskPath = path.join(projectRoot, 'tasks', taskId, 'task.json');
    let localTask;
    try {
      localTask = await readJson(taskPath);
    } catch (e) {
      return { ok: false, error: `Local task file not found or unreadable at ${taskPath}: ${e.message}` };
    }

    const merged = mergeTaskFromCommit(localTask, commitTask);

    // Validate before writing
    const { valid, errors } = validateTask(merged);
    if (!valid) {
      return { ok: false, error: `Merged task invalid: ${errors.join(', ')}` };
    }

    // No-op check to avoid unnecessary writes
    if (JSON.stringify(localTask) === JSON.stringify(merged)) {
      return { ok: true, path: taskPath, updated: false };
    }

    await writeJson(taskPath, merged);
    return { ok: true, path: taskPath, updated: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export default {
  updateLocalTaskFromCommit,
};
