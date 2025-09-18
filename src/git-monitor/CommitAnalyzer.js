import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * CommitAnalyzer
 * Utilities to inspect a given git commit and extract feature/task status by
 * locating and parsing a task.json file directly from the commit tree.
 *
 * This avoids switching branches or checking out the tree by using:
 *  - git ls-tree -r --name-only <rev>
 *  - git show <rev>:<path>
 */

/**
 * Execute a git command safely with a timeout.
 * Returns { stdout, stderr } and never throws; on error, stdout is ''.
 */
async function safeGit(repoPath, args) {
  try {
    return await execFileAsync('git', args, { cwd: repoPath, timeout: 20_000 })
  } catch (e) {
    return { stdout: '', stderr: e?.message || String(e) }
  }
}

/**
 * List all files under a given revision tree.
 * @param {string} repoPath
 * @param {string} revision - commit SHA or ref
 * @returns {Promise<string[]>}
 */
export async function listFilesAtRevision(repoPath, revision) {
  const res = await safeGit(repoPath, ['ls-tree', '-r', '--name-only', revision])
  if (!res.stdout) return []
  return res.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

/**
 * Read a file's content at a specific revision without checkout.
 * @param {string} repoPath
 * @param {string} revision - commit SHA or ref
 * @param {string} filePath - path within repo
 * @returns {Promise<string|null>} returns null if not found
 */
export async function readFileAtRevision(repoPath, revision, filePath) {
  const spec = `${revision}:${filePath}`
  const res = await safeGit(repoPath, ['show', spec])
  if (!res.stdout) return null
  return res.stdout
}

function stripBom(str) {
  if (str.charCodeAt(0) === 0xfeff) return str.slice(1)
  return str
}

// Naive removal of // and /* */ comments to tolerate JSON-with-comments.
function stripJsonComments(str) {
  return (
    str
      // remove block comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // remove line comments
      .replace(/(^|\s)\/\/.*$/gm, '$1')
  )
}

/**
 * Try to parse task.json with some tolerance for comments/BOM.
 * @param {string} content
 * @returns {any}
 */
export function parseTaskJson(content) {
  if (typeof content !== 'string') return null
  const cleaned = stripJsonComments(stripBom(content))
  try {
    return JSON.parse(cleaned)
  } catch (_) {
    return null
  }
}

/**
 * Extract a lightweight summary from a parsed task.json.
 * Attempts to find common fields: status, features (array), id/title, etc.
 * Falls back to returning nulls if not present.
 * @param {any} taskObj
 * @returns {{ status: string|null, summary: object|null, features: Array<object>|null }}
 */
export function extractTaskSummary(taskObj) {
  if (!taskObj || typeof taskObj !== 'object') {
    return { status: null, summary: null, features: null }
  }

  const status = taskObj.status || taskObj.state || null

  // Normalize features if present
  let features = null
  if (Array.isArray(taskObj.features)) {
    features = taskObj.features.map((f) => ({
      id: f?.id ?? f?.featureId ?? null,
      title: f?.title ?? null,
      status: f?.status ?? f?.state ?? null,
      description: f?.description ?? null,
    }))
  } else if (Array.isArray(taskObj.tasks)) {
    // Some schemas may name them tasks
    features = taskObj.tasks.map((f) => ({
      id: f?.id ?? f?.taskId ?? null,
      title: f?.title ?? null,
      status: f?.status ?? f?.state ?? null,
      description: f?.description ?? null,
    }))
  }

  // A minimal summary with a few common fields
  const summary = {
    id: taskObj.id ?? taskObj.taskId ?? null,
    title: taskObj.title ?? taskObj.name ?? null,
    status,
  }

  return { status, summary, features }
}

/**
 * Analyze a given commit for a task.json file and extract status/details.
 * @param {string} repoPath
 * @param {string} commitSha
 * @param {{ fileName?: string }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   commit: string,
 *   found: boolean,
 *   taskJsonPath?: string|null,
 *   taskRaw?: any,
 *   extracted?: { status: string|null, summary: object|null, features: Array<object>|null },
 *   error?: string
 * }>}
 */
export async function analyzeCommitForTask(repoPath, commitSha, options = {}) {
  const fileName = options.fileName || 'task.json'

  // List files in commit to find task.json candidates
  const files = await listFilesAtRevision(repoPath, commitSha)
  if (!files.length) {
    return { ok: false, commit: commitSha, found: false, error: 'No files found at commit' }
  }

  const candidates = files.filter((p) => p.split('/').pop() === fileName)
  if (!candidates.length) {
    return { ok: true, commit: commitSha, found: false }
  }

  // Prefer root-level or tasks/ first
  const prioritized = candidates.sort((a, b) => {
    const score = (p) => {
      const isRoot = !p.includes('/')
      const inTasks = p.startsWith('tasks/') || p.includes('/tasks/')
      return (isRoot ? 2 : 0) + (inTasks ? 1 : 0)
    }
    return score(b) - score(a)
  })

  for (const taskPath of prioritized) {
    const content = await readFileAtRevision(repoPath, commitSha, taskPath)
    if (!content) continue
    const parsed = parseTaskJson(content)
    if (!parsed) continue

    const extracted = extractTaskSummary(parsed)
    return {
      ok: true,
      commit: commitSha,
      found: true,
      taskJsonPath: taskPath,
      taskRaw: parsed,
      extracted,
    }
  }

  return { ok: true, commit: commitSha, found: false }
}

/**
 * Convenience: analyze the HEAD commit of a branch.
 * @param {string} repoPath
 * @param {string} branchName
 * @param {{ fileName?: string }} [options]
 */
export async function analyzeBranchHeadForTask(repoPath, branchName, options = {}) {
  const head = await safeGit(repoPath, ['rev-parse', branchName])
  const commit = head.stdout?.trim()
  if (!commit)
    return { ok: false, commit: null, found: false, error: 'Unable to resolve branch head' }
  return analyzeCommitForTask(repoPath, commit, options)
}

export default {
  listFilesAtRevision,
  readFileAtRevision,
  parseTaskJson,
  extractTaskSummary,
  analyzeCommitForTask,
  analyzeBranchHeadForTask,
}
