/**
 * Update local task state from data extracted from a commit's task.json.
 *
 * Responsibilities:
 * - Normalize commit task data (supports different schemas: id/taskId, features/tasks, status/state).
 * - Locate local tasks/<taskId>/task.json and merge in updates.
 * - Sync feature statuses (by feature id primarily, then by title as a fallback) and task status.
 * - Preserve existing fields in local file (context, blockers, acceptance, etc.).
 * - Add metadata about the sync under task.gitSync (last commit, branch, path, timestamp).
 *
 * This module lives near GitMonitorManager and is intended to be called by the
 * monitor when a relevant commit containing a task.json is detected.
 */

import fs from 'node:fs'
import path from 'node:path'

function stripBom(str) {
  if (!str) return str
  if (str.charCodeAt(0) === 0xfeff) return str.slice(1)
  return str
}

function safeParseJson(str) {
  try {
    return JSON.parse(stripBom(str))
  } catch (_) {
    return null
  }
}

function deepClone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj))
}

/**
 * Normalize various potential commit task.json shapes into a common model.
 * @param {any} commitData - Either the raw parsed task.json object or an object
 *                           like { status, summary, features } from CommitAnalyzer.
 * @returns {{
 *   taskId: string|null,
 *   title: string|null,
 *   description: string|null,
 *   status: string|null,
 *   features: Array<{ id: string|null, title: string|null, description?: string|null, status: string|null }>
 * }}
 */
export function normalizeCommitTaskData(commitData) {
  if (!commitData || typeof commitData !== 'object') {
    return { taskId: null, title: null, description: null, status: null, features: [] }
  }

  // If this looks like the CommitAnalyzer extracted shape
  if (
    Object.prototype.hasOwnProperty.call(commitData, 'status') &&
    Object.prototype.hasOwnProperty.call(commitData, 'summary') &&
    Object.prototype.hasOwnProperty.call(commitData, 'features')
  ) {
    const summary = commitData.summary || {}
    const features = Array.isArray(commitData.features)
      ? commitData.features.map((f) => ({
          id: f?.id ?? f?.featureId ?? null,
          title: f?.title ?? null,
          description: f?.description ?? null,
          status: f?.status ?? f?.state ?? null,
        }))
      : []

    return {
      taskId: summary.id ?? null,
      title: summary.title ?? null,
      description: null,
      status: commitData.status ?? null,
      features,
    }
  }

  // Otherwise treat it as the raw task.json object from the commit
  const status = commitData.status ?? commitData.state ?? null
  const featuresArr = Array.isArray(commitData.features)
    ? commitData.features
    : Array.isArray(commitData.tasks)
    ? commitData.tasks
    : []

  const features = featuresArr.map((f) => ({
    id: f?.id ?? f?.featureId ?? null,
    title: f?.title ?? null,
    description: f?.description ?? null,
    status: f?.status ?? f?.state ?? null,
  }))

  return {
    taskId: commitData.id ?? commitData.taskId ?? null,
    title: commitData.title ?? commitData.name ?? null,
    description: commitData.description ?? null,
    status,
    features,
  }
}

/**
 * Merge commit-normalized data into a local task object (in-memory mutation of a clone).
 * Updates task.status and features[].status if provided by commit.
 * Adds new features that appear in commit but not locally.
 * Preserves unknown fields on existing features.
 * @param {any} localTaskObj
 * @param {{ taskId: string|null, title: string|null, description: string|null, status: string|null, features: Array<any> }} normalized
 * @returns {{ updatedTask: any, changeSummary: { taskStatusChanged: boolean, updatedFeatures: string[], addedFeatures: string[] } }}
 */
export function mergeCommitDataIntoLocal(localTaskObj, normalized) {
  const updated = deepClone(localTaskObj) || {}
  const changeSummary = { taskStatusChanged: false, updatedFeatures: [], addedFeatures: [] }

  if (normalized.status != null && normalized.status !== updated.status) {
    updated.status = normalized.status
    changeSummary.taskStatusChanged = true
  }

  if (!Array.isArray(updated.features)) updated.features = []
  const localById = new Map()
  const localByTitle = new Map()
  for (const f of updated.features) {
    if (f && typeof f === 'object') {
      if (f.id) localById.set(String(f.id), f)
      if (f.title) localByTitle.set(String(f.title).toLowerCase(), f)
    }
  }

  for (const cf of normalized.features || []) {
    const cid = cf?.id != null ? String(cf.id) : null
    const ctitleKey = cf?.title ? String(cf.title).toLowerCase() : null

    let target = null
    if (cid && localById.has(cid)) target = localById.get(cid)
    else if (ctitleKey && localByTitle.has(ctitleKey)) target = localByTitle.get(ctitleKey)

    if (target) {
      // Update status if provided
      if (cf.status != null && cf.status !== target.status) {
        target.status = cf.status
        if (cid) changeSummary.updatedFeatures.push(cid)
        else if (target.id) changeSummary.updatedFeatures.push(String(target.id))
      }
      // Optionally update description/title if commit provides and local missing
      if (cf.title && !target.title) target.title = cf.title
      if (cf.description && !target.description) target.description = cf.description
    } else {
      // Add as a new feature entry with minimal fields, maintain structure
      const newFeature = {
        id: cid || null,
        title: cf?.title ?? null,
        description: cf?.description ?? null,
        status: cf?.status ?? null,
      }
      updated.features.push(newFeature)
      if (newFeature.id) changeSummary.addedFeatures.push(String(newFeature.id))
    }
  }

  // Maintain featureIdToDisplayIndex for any new features
  const map = updated.featureIdToDisplayIndex || {}
  let maxIndex = 0
  for (const v of Object.values(map)) {
    const n = typeof v === 'number' ? v : 0
    if (n > maxIndex) maxIndex = n
  }
  for (const fid of changeSummary.addedFeatures) {
    if (fid && !Object.prototype.hasOwnProperty.call(map, fid)) {
      map[fid] = maxIndex + 1
      maxIndex += 1
    }
  }
  updated.featureIdToDisplayIndex = map

  return { updatedTask: updated, changeSummary }
}

/**
 * Update local tasks/<taskId>/task.json given commit-provided task data.
 *
 * @param {string} projectRoot - Repository root path containing the tasks/ directory.
 * @param {any} commitTaskData - Either raw commit task.json object or CommitAnalyzer's extracted object.
 * @param {{
 *   taskId?: string,
 *   gitMeta?: { commit?: string|null, branch?: string|null, taskJsonPath?: string|null },
 *   ensureExists?: boolean // if true and task file missing, will not create; returns ok:false (default: true => must exist)
 * }} [options]
 * @returns {Promise<{ ok: boolean, path?: string, changes?: any, error?: string }>}
 */
export async function updateLocalTaskStateFromCommit(projectRoot, commitTaskData, options = {}) {
  try {
    const normalized = normalizeCommitTaskData(commitTaskData)
    const taskId = options.taskId || normalized.taskId
    if (!taskId) {
      return { ok: false, error: 'Unable to determine taskId from commit data or options' }
    }

    const taskDir = path.join(projectRoot, 'tasks', String(taskId))
    const taskJsonPath = path.join(taskDir, 'task.json')

    if (!fs.existsSync(taskJsonPath)) {
      return { ok: false, error: `Local task file not found: ${taskJsonPath}` }
    }

    const raw = fs.readFileSync(taskJsonPath, 'utf8')
    const local = safeParseJson(raw)
    if (!local || typeof local !== 'object') {
      return { ok: false, error: 'Local task.json is invalid JSON' }
    }

    const { updatedTask, changeSummary } = mergeCommitDataIntoLocal(local, normalized)

    // Attach git sync metadata
    const nowIso = new Date().toISOString()
    updatedTask.gitSync = {
      ...(updatedTask.gitSync || {}),
      lastSyncedAt: nowIso,
      lastCommit: options.gitMeta?.commit || null,
      lastBranch: options.gitMeta?.branch || null,
      lastTaskJsonPath: options.gitMeta?.taskJsonPath || null,
      source: 'commit',
    }

    // Only write if there are changes or metadata update; for simplicity, always write if different
    const nextStr = JSON.stringify(updatedTask, null, 2) + '\n'
    if (nextStr !== raw) {
      fs.writeFileSync(taskJsonPath, nextStr, 'utf8')
    }

    return { ok: true, path: taskJsonPath, changes: changeSummary }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default {
  normalizeCommitTaskData,
  mergeCommitDataIntoLocal,
  updateLocalTaskStateFromCommit,
}
