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
    // Start polling automatically
    this.startWatching()
  }

  stopWatching() {
    if (this._interval) clearInterval(this._interval)
    this._interval = null
  }

  startWatching() {
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
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}

    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_GET_STATUS] = async () => await this.getStatus()
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_TRIGGER_POLL] = async () => {
      await this._tick()
      return this._lastSnapshot
    }
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_SET_POLL_INTERVAL] = async ({ ms }) => {
      if (typeof ms === 'number' && ms >= 5_000 && ms <= 10 * 60_000) {
        this._pollMs = ms
        this.startWatching()
      }
      return { ok: true, ms: this._pollMs }
    }

    for (const key of Object.keys(handlers)) {
      ipcMain.handle(key, async (_event, args) => {
        try {
          return await handlers[key](args)
        } catch (e) {
          console.error(`[git-monitor] ${key} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
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

    const currentBranch = (await this._safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoPath }))
      .stdout.trim()

    const branchListRaw = (await this._safeExec('git', ['for-each-ref', '--format=%(refname:short):::%(objectname):::%(committerdate:iso8601)', 'refs/heads/'], { cwd: repoPath }))
      .stdout

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

  _emitUpdate(payload) {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send(IPC_HANDLER_KEYS.GIT_MONITOR_SUBSCRIBE, payload)
    } catch (e) {
      console.warn('[git-monitor] emit failed', e?.message || e)
    }
  }
}
