import { ipcMain } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'

const execFileAsync = promisify(execFile)

/**
 * GitMonitorManager
 * - Periodically checks the project git repo for updates.
 * - Fetches remotes and lists branches with their latest commit SHAs and timestamps.
 * - Emits updates to renderer over IPC subscribe channel.
 *
 * This is a foundation service; further logic (task/feature correlation) will be built atop.
 */
export class GitMonitorManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false

    this._interval = null
    this._pollMs = 30_000 // 30 seconds default
    this._lastSnapshot = null
  }

  async init() {
    this._registerIpcHandlers()
    this.__startWatching()
  }

  stopWatching() {
    if (this._interval) clearInterval(this._interval)
    this._interval = null
  }

  __startWatching() {
    this.stopWatching()
    // Immediate tick then interval
    this._tick().catch((e) => console.warn('[git-monitor] initial tick failed', e?.message || e))
    this._interval = setInterval(() => {
      this._tick().catch((e) => console.warn('[git-monitor] tick failed', e?.message || e))
    }, this._pollMs)
  }

  async _tick() {
    try {
      const status = await this.getStatus()
      if (JSON.stringify(status) !== JSON.stringify(this._lastSnapshot)) {
        this._lastSnapshot = status
        this._emitUpdate(status)
      }
    } catch (e) {
      console.warn('[git-monitor] tick error', e?.message || e)
    }
    return this._lastSnapshot
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}

    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GET_STATUS] = async () => await this.getStatus()
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_TRIGGER_POLL] = async () => await this._tick()
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_SET_POLL_INTERVAL] = async ({ ms }) =>
      await this.setPollInterval(ms)

    // New: branch unmerged check and merge
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_HAS_UNMERGED] = async ({ branchName, baseBranch }) =>
      await this.hasUnmergedCommits(branchName, baseBranch)

    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_MERGE_BRANCH] = async ({ branchName, baseBranch }) =>
      await this.mergeBranchIntoBase(branchName, baseBranch)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  async setPollInterval(ms) {
    if (typeof ms === 'number' && ms >= 5_000 && ms <= 10 * 60_000) {
      this._pollMs = ms
      this.__startWatching()
    }
  }

  async getStatus() {
    const repoPath = this._resolveRepoRoot()
    const hasGit = !!repoPath

    if (!hasGit) {
      return {
        ok: true,
        repoPath: null,
        branches: [],
        currentBranch: null,
        lastFetchAt: null,
        lastUpdatedAt: new Date().toISOString(),
      }
    }

    // fetch with a timeout safeguard
    await this._safeExec('git', ['fetch', '--all', '--prune'], { cwd: repoPath })

    const currentBranch = (
      await this._safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath })
    ).stdout.trim()

    const branchListRaw = (
      await this._safeExec(
        'git',
        [
          'for-each-ref',
          '--format=%(refname:short):::%(objectname):::%(committerdate:iso8601)',
          'refs/heads/',
        ],
        { cwd: repoPath },
      )
    ).stdout

    const branches = branchListRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, sha, date] = line.split(':::')
        return { name, sha, lastCommitAt: date }
      })

    let lastFetchAt = null
    try {
      const fetchHeadPath = path.join(repoPath, '.git', 'FETCH_HEAD')
      const stat = fs.statSync(fetchHeadPath)
      lastFetchAt = stat.mtime.toISOString()
    } catch (_) {}

    return {
      ok: true,
      repoPath,
      branches,
      currentBranch,
      lastFetchAt,
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  _resolveRepoRoot() {
    // Use projectRoot directly; validate it has a .git dir
    try {
      const gitDir = path.join(this.projectRoot, '.git')
      if (fs.existsSync(gitDir)) return this.projectRoot
    } catch (_) {}
    return null
  }

  async _safeExec(cmd, args, options) {
    try {
      return await execFileAsync(cmd, args, { timeout: 20_000, ...options })
    } catch (e) {
      // Return empty result so monitoring keeps going
      return { stdout: '', stderr: e?.message || String(e) }
    }
  }

  async _exec(cmd, args, options) {
    // Strict exec: throws on error
    return await execFileAsync(cmd, args, { timeout: 60_000, ...options })
  }

  _emitUpdate(payload) {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.GIT_MONITOR_SUBSCRIBE, payload)
    } catch (e) {
      console.warn('[git-monitor] emit failed', e?.message || e)
    }
  }

  async _ensureRepo() {
    const repoPath = this._resolveRepoRoot()
    if (!repoPath) return { ok: false, error: 'No git repository detected' }
    return { ok: true, repoPath }
  }

  async _currentBranch(repoPath) {
    const res = await this._safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath })
    return res.stdout.trim()
  }

  async _branchExists(repoPath, branchName) {
    const res = await this._safeExec('git', ['rev-parse', '--verify', '--quiet', branchName], { cwd: repoPath })
    return !!res.stdout.trim()
  }

  async hasUnmergedCommits(branchName, baseBranch) {
    try {
      const ensured = await this._ensureRepo()
      if (!ensured.ok) return ensured
      const { repoPath } = ensured

      if (!branchName || typeof branchName !== 'string') {
        return { ok: false, error: 'branchName is required' }
      }

      await this._safeExec('git', ['fetch', '--all', '--prune'], { cwd: repoPath })
      const base = baseBranch || (await this._currentBranch(repoPath))

      if (base === branchName) {
        return { ok: true, hasUnmerged: false, reason: 'base equals branch' }
      }

      const exists = await this._branchExists(repoPath, branchName)
      if (!exists) {
        return { ok: true, hasUnmerged: false, notFound: true }
      }

      const countRes = await this._safeExec('git', ['rev-list', '--count', `${base}..${branchName}`], {
        cwd: repoPath,
      })
      const count = parseInt((countRes.stdout || '0').trim(), 10)
      const hasUnmerged = Number.isFinite(count) && count > 0
      return { ok: true, hasUnmerged, aheadCount: Number.isFinite(count) ? count : 0, base, branch: branchName }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  }

  async mergeBranchIntoBase(branchName, baseBranch) {
    try {
      const ensured = await this._ensureRepo()
      if (!ensured.ok) return ensured
      const { repoPath } = ensured

      if (!branchName || typeof branchName !== 'string') {
        return { ok: false, error: 'branchName is required' }
      }

      await this._exec('git', ['fetch', '--all', '--prune'], { cwd: repoPath })

      const base = baseBranch || (await this._currentBranch(repoPath))
      if (base === branchName) {
        return { ok: false, error: 'Refusing to merge a branch into itself' }
      }

      // Clean working tree check
      const status = await this._exec('git', ['status', '--porcelain'], { cwd: repoPath })
      if (status.stdout.trim().length > 0) {
        return { ok: false, error: 'Working tree not clean. Commit or stash changes before merging.' }
      }

      // Ensure both branches exist
      const featureExists = await this._branchExists(repoPath, branchName)
      if (!featureExists) return { ok: false, error: `Branch not found: ${branchName}` }

      // Checkout base branch
      await this._exec('git', ['checkout', base], { cwd: repoPath })
      // Pull latest (fast-forward only for safety)
      await this._exec('git', ['pull', '--ff-only'], { cwd: repoPath })

      // Check if there are unmerged commits; if none, exit early
      const pre = await this.hasUnmergedCommits(branchName, base)
      if (pre.ok && !pre.hasUnmerged) {
        return { ok: true, merged: false, reason: 'No commits to merge' }
      }

      // Perform merge (no-ff for explicit merge commit; auto message)
      try {
        await this._exec('git', ['merge', '--no-ff', '--no-edit', branchName], { cwd: repoPath })
      } catch (mergeErr) {
        // Try to abort merge to clean state
        await this._safeExec('git', ['merge', '--abort'], { cwd: repoPath })
        return { ok: false, error: `Merge failed: ${mergeErr?.message || mergeErr}` }
      }

      // Get new head sha
      const head = await this._exec('git', ['rev-parse', 'HEAD'], { cwd: repoPath })
      const newSha = head.stdout.trim()

      // Emit update
      await this._tick()

      return { ok: true, merged: true, base, branch: branchName, commit: newSha }
    } catch (e) {
      return { ok: false, error: String(e?.message || e) }
    }
  }
}
