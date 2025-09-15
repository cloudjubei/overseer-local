import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'

import gitHelper from './gitHelper'
import { analyzeBranchHeadForTask } from './CommitAnalyzer'
import { updateLocalTaskStateFromCommit } from './updateLocalTaskStateFromCommit'
import { isFeatureBranchName, branchNameToTaskId } from './taskBranchNaming'

/**
 * GitMonitorManager
 * - Periodically checks the project git repo for updates.
 * - Fetches remotes and lists branches with their latest commit SHAs and timestamps.
 * - Emits updates to renderer over IPC subscribe channel.
 * - Uses CommitAnalyzer to detect task.json in feature branches and updates local tasks.
 */
export class GitMonitorManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot
    this.window = window
    this._ipcBound = false

    this._interval = null
    this._pollMs = 30_000 // 30 seconds default
    this._lastSnapshot = null

    // Cache of last analyzed commit per branch to avoid repeated work
    this._branchAnalysis = new Map() // branchName -> commitSha
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
    this._tick().catch((e) => console.warn('[git-monitor] initial tick failed', e?.message || e))
    this._interval = setInterval(() => {
      this._tick().catch((e) => console.warn('[git-monitor] tick failed', e?.message || e))
    }, this._pollMs)
  }

  async _tick() {
    try {
      const status = await this.getStatus()

      // Try to analyze feature branches for task.json updates
      if (status?.ok && status?.repoPath && Array.isArray(status?.branches)) {
        await this._analyzeFeatureBranches(status.repoPath, status.branches)
      }

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

    // Unmerged check and merge operations delegated to gitHelper
    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_HAS_UNMERGED] = async ({ branchName, baseBranch }) =>
      await gitHelper.hasUnmergedCommits(this.projectRoot, branchName, baseBranch)

    handlers[IPC_HANDLER_KEYS.GIT_MONITOR_MERGE_BRANCH] = async ({ branchName, baseBranch }) => {
      const result = await gitHelper.mergeBranchIntoBase(this.projectRoot, branchName, baseBranch)
      if (result?.ok) {
        // Refresh snapshot after merge
        await this._tick()
      }
      return result
    }

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
    return await gitHelper.getStatus(this.projectRoot)
  }

  async _analyzeFeatureBranches(repoPath, branches) {
    // Filter feature branches only
    const featureBranches = branches.filter((b) => isFeatureBranchName(b?.name))

    for (const b of featureBranches) {
      const branchName = b.name
      const headCommit = b.sha

      if (!branchName || !headCommit) continue

      // Skip if we've already analyzed this commit for this branch
      const last = this._branchAnalysis.get(branchName)
      if (last && last === headCommit) continue

      try {
        const analysis = await analyzeBranchHeadForTask(repoPath, branchName)
        if (analysis?.ok && analysis?.found) {
          const taskId = branchNameToTaskId(branchName) || analysis?.extracted?.summary?.id || null

          const commitTaskData = analysis.taskRaw || analysis.extracted || null
          if (commitTaskData && taskId) {
            await updateLocalTaskStateFromCommit(this.projectRoot, commitTaskData, {
              taskId,
              gitMeta: {
                commit: analysis.commit,
                branch: branchName,
                taskJsonPath: analysis.taskJsonPath || null,
              },
            })
          }
        }

        // Mark as analyzed for this commit regardless of found or not, to avoid rework
        this._branchAnalysis.set(branchName, headCommit)
      } catch (e) {
        console.warn('[git-monitor] analyze branch failed', branchName, e?.message || e)
      }
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
