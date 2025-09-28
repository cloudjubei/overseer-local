import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'

const execFileAsync = promisify(execFile)

export async function safeExec(cmd, args, options) {
  try {
    return await execFileAsync(cmd, args, { timeout: 20_000, ...options })
  } catch (e) {
    return { stdout: '', stderr: e?.message || String(e) }
  }
}

export async function exec(cmd, args, options) {
  return await execFileAsync(cmd, args, { timeout: 60_000, ...options })
}

export function resolveRepoRoot(projectRoot) {
  try {
    const gitDir = path.join(projectRoot, '.git')
    if (fs.existsSync(gitDir)) return projectRoot
  } catch (_) {}
  return null
}

export async function fetchAll(repoPath) {
  return await safeExec('git', ['fetch', '--all', '--prune'], { cwd: repoPath })
}

export async function getCurrentBranch(repoPath) {
  const res = await safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath })
  return res.stdout.trim()
}

export async function listLocalBranches(repoPath) {
  const res = await safeExec(
    'git',
    [
      'for-each-ref',
      '--format=%(refname:short):::%(objectname):::%(committerdate:iso8601)',
      'refs/heads/',
    ],
    { cwd: repoPath },
  )
  const raw = res.stdout || ''
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, sha, date] = line.split(':::')
      return { name, sha, lastCommitAt: date }
    })
}

export function getLastFetchAt(repoPath) {
  try {
    const fetchHeadPath = path.join(repoPath, '.git', 'FETCH_HEAD')
    const stat = fs.statSync(fetchHeadPath)
    return stat.mtime.toISOString()
  } catch (_) {
    return null
  }
}

export async function getStatus(projectRoot) {
  const repoPath = resolveRepoRoot(projectRoot)
  if (!repoPath) {
    return {
      ok: true,
      repoPath: null,
      branches: [],
      currentBranch: null,
      lastFetchAt: null,
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  await fetchAll(repoPath)
  const currentBranch = await getCurrentBranch(repoPath)
  const branches = await listLocalBranches(repoPath)
  const lastFetchAt = getLastFetchAt(repoPath)
  return {
    ok: true,
    repoPath,
    branches,
    currentBranch,
    lastFetchAt,
    lastUpdatedAt: new Date().toISOString(),
  }
}

export async function branchExists(repoPath, branchName) {
  const res = await safeExec('git', ['rev-parse', '--verify', '--quiet', branchName], {
    cwd: repoPath,
  })
  return !!res.stdout.trim()
}

export async function hasUnmergedCommits(projectRoot, branchName, baseBranch) {
  try {
    const repoPath = resolveRepoRoot(projectRoot)
    if (!repoPath) return { ok: false, error: 'No git repository detected' }

    if (!branchName || typeof branchName !== 'string') {
      return { ok: false, error: 'branchName is required' }
    }

    await fetchAll(repoPath)
    const base = baseBranch || (await getCurrentBranch(repoPath))

    if (base === branchName) {
      return { ok: true, hasUnmerged: false, reason: 'base equals branch' }
    }

    const exists = await branchExists(repoPath, branchName)
    if (!exists) {
      return { ok: true, hasUnmerged: false, notFound: true }
    }

    const countRes = await safeExec('git', ['rev-list', '--count', `${base}..${branchName}`], {
      cwd: repoPath,
    })
    const count = parseInt((countRes.stdout || '0').trim(), 10)
    const hasUnmerged = Number.isFinite(count) && count > 0
    return {
      ok: true,
      hasUnmerged,
      aheadCount: Number.isFinite(count) ? count : 0,
      base,
      branch: branchName,
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export async function mergeBranchIntoBase(projectRoot, branchName, baseBranch) {
  try {
    const repoPath = resolveRepoRoot(projectRoot)
    if (!repoPath) return { ok: false, error: 'No git repository detected' }

    if (!branchName || typeof branchName !== 'string') {
      return { ok: false, error: 'branchName is required' }
    }

    await exec('git', ['fetch', '--all', '--prune'], { cwd: repoPath })

    const base = baseBranch || (await getCurrentBranch(repoPath))
    if (base === branchName) {
      return { ok: false, error: 'Refusing to merge a branch into itself' }
    }

    const status = await exec('git', ['status', '--porcelain'], { cwd: repoPath })
    if (status.stdout.trim().length > 0) {
      return { ok: false, error: 'Working tree not clean. Commit or stash changes before merging.' }
    }

    const featureExists = await branchExists(repoPath, branchName)
    if (!featureExists) return { ok: false, error: `Branch not found: ${branchName}` }

    await exec('git', ['checkout', base], { cwd: repoPath })
    await exec('git', ['pull', '--ff-only'], { cwd: repoPath })

    const pre = await hasUnmergedCommits(projectRoot, branchName, base)
    if (pre.ok && !pre.hasUnmerged) {
      return { ok: true, merged: false, reason: 'No commits to merge' }
    }

    try {
      await exec('git', ['merge', '--no-ff', '--no-edit', branchName], { cwd: repoPath })
    } catch (mergeErr) {
      await safeExec('git', ['merge', '--abort'], { cwd: repoPath })
      return { ok: false, error: `Merge failed: ${mergeErr?.message || mergeErr}` }
    }

    const head = await exec('git', ['rev-parse', 'HEAD'], { cwd: repoPath })
    const newSha = head.stdout.trim()

    return { ok: true, merged: true, base, branch: branchName, commit: newSha }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

export default {
  resolveRepoRoot,
  safeExec,
  exec,
  fetchAll,
  getCurrentBranch,
  listLocalBranches,
  getLastFetchAt,
  getStatus,
  branchExists,
  hasUnmergedCommits,
  mergeBranchIntoBase,
}
