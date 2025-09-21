/**
 * Update local story state from data extracted from a commit's story.json.
 *
 * Responsibilities:
 * - Normalize commit story data (supports different schemas: id/storyId, features/stories, status/state).
 * - Locate local stories/<storyId>/story.json and merge in updates.
 * - Sync feature statuses (by feature id primarily, then by title as a fallback) and story status.
 * - Preserve existing fields in local file (context, blockers, acceptance, etc.).
 * - Add metadata about the sync under story.gitSync (last commit, branch, path, timestamp).
 *
 * This module lives near GitMonitorManager and is intended to be called by the
 * monitor when a relevant commit containing a story.json is detected.
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
 * Normalize various potential commit story.json shapes into a common model.
 * @param {any} commitData - Either the raw parsed story.json object or an object
 *                           like { status, summary, features } from CommitAnalyzer.
 * @returns {{
 *   storyId: string|null,
 *   title: string|null,
 *   description: string|null,
 *   status: string|null,
 *   features: Array<{ id: string|null, title: string|null, description?: string|null, status: string|null }>
 * }}
 */
export function normalizeCommitStoryData(commitData) {
  if (!commitData || typeof commitData !== 'object') {
    return { storyId: null, title: null, description: null, status: null, features: [] }
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
      storyId: summary.id ?? null,
      title: summary.title ?? null,
      description: null,
      status: commitData.status ?? null,
      features,
    }
  }

  // Otherwise treat it as the raw story.json object from the commit
  const status = commitData.status ?? commitData.state ?? null
  const featuresArr = Array.isArray(commitData.features)
    ? commitData.features
    : Array.isArray(commitData.stories)
      ? commitData.stories
      : []

  const features = featuresArr.map((f) => ({
    id: f?.id ?? f?.featureId ?? null,
    title: f?.title ?? null,
    description: f?.description ?? null,
    status: f?.status ?? f?.state ?? null,
  }))

  return {
    storyId: commitData.id ?? commitData.storyId ?? null,
    title: commitData.title ?? commitData.name ?? null,
    description: commitData.description ?? null,
    status,
    features,
  }
}

/**
 * Merge commit-normalized data into a local story object (in-memory mutation of a clone).
 * Updates story.status and features[].status if provided by commit.
 * Adds new features that appear in commit but not locally.
 * Preserves unknown fields on existing features.
 * @param {any} localStoryObj
 * @param {{ storyId: string|null, title: string|null, description: string|null, status: string|null, features: Array<any> }} normalized
 * @returns {{ updatedStory: any, changeSummary: { storyStatusChanged: boolean, updatedFeatures: string[], addedFeatures: string[] } }}
 */
export function mergeCommitDataIntoLocal(localStoryObj, normalized) {
  const updated = deepClone(localStoryObj) || {}
  const changeSummary = { storyStatusChanged: false, updatedFeatures: [], addedFeatures: [] }

  if (normalized.status != null && normalized.status !== updated.status) {
    updated.status = normalized.status
    changeSummary.storyStatusChanged = true
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

  return { updatedStory: updated, changeSummary }
}

/**
 * Update local stories/<storyId>/story.json given commit-provided story data.
 *
 * @param {string} projectRoot - Repository root path containing the stories/ directory.
 * @param {any} commitStoryData - Either raw commit story.json object or CommitAnalyzer's extracted object.
 * @param {{
 *   storyId?: string,
 *   gitMeta?: { commit?: string|null, branch?: string|null, storyJsonPath?: string|null },
 *   ensureExists?: boolean // if true and story file missing, will not create; returns ok:false (default: true => must exist)
 * }} [options]
 * @returns {Promise<{ ok: boolean, path?: string, changes?: any, error?: string }>}
 */
export async function updateLocalStoryStateFromCommit(projectRoot, commitStoryData, options = {}) {
  try {
    const normalized = normalizeCommitStoryData(commitStoryData)
    const storyId = options.storyId || normalized.storyId
    if (!storyId) {
      return { ok: false, error: 'Unable to determine storyId from commit data or options' }
    }

    const storyDir = path.join(projectRoot, 'stories', String(storyId))
    const storyJsonPath = path.join(storyDir, 'story.json')

    if (!fs.existsSync(storyJsonPath)) {
      return { ok: false, error: `Local story file not found: ${storyJsonPath}` }
    }

    const raw = fs.readFileSync(storyJsonPath, 'utf8')
    const local = safeParseJson(raw)
    if (!local || typeof local !== 'object') {
      return { ok: false, error: 'Local story.json is invalid JSON' }
    }

    const { updatedStory, changeSummary } = mergeCommitDataIntoLocal(local, normalized)

    // Attach git sync metadata
    const nowIso = new Date().toISOString()
    updatedStory.gitSync = {
      ...(updatedStory.gitSync || {}),
      lastSyncedAt: nowIso,
      lastCommit: options.gitMeta?.commit || null,
      lastBranch: options.gitMeta?.branch || null,
      lastStoryJsonPath: options.gitMeta?.storyJsonPath || null,
      source: 'commit',
    }

    // Only write if there are changes or metadata update; for simplicity, always write if different
    const nextStr = JSON.stringify(updatedStory, null, 2) + '\n'
    if (nextStr !== raw) {
      fs.writeFileSync(storyJsonPath, nextStr, 'utf8')
    }

    return { ok: true, path: storyJsonPath, changes: changeSummary }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default {
  normalizeCommitStoryData,
  mergeCommitDataIntoLocal,
  updateLocalStoryStateFromCommit,
}
