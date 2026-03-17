import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import { GitCommitInfo, GitBranchEvent, GitUnifiedBranch, GitStashListItem } from 'thefactory-tools'
import { notificationsService } from '../services/notificationsService'

export type PendingBranch = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  storyId?: string
  featureId?: string
  totals?: { insertions: number; deletions: number; filesChanged: number }
  ahead: number
  behind: number
}

export type ProjectGitStatus = {
  projectId: string
  pending: PendingBranch[]
}

export type MergePreferences = {
  autoPush: boolean
  deleteRemote: boolean
  setAutoPush: (v: boolean) => void
  setDeleteRemote: (v: boolean) => void
}

export type UnifiedBranchesState = {
  loading: boolean
  error?: string
  branches: GitUnifiedBranch[]
  stashes?: GitStashListItem[]
  // Divergence of each branch against the current branch (by effective headRef key)
  relToCurrent?: Record<string, { ahead: number; behind: number }>
}

export type PendingFeatureRefsState = {
  loading: boolean
  error?: string
  entries: Array<{ storyId: string; featureId?: string }>
  commits?: GitCommitInfo[]
}

export type GitSelection =
  | { kind: 'branch'; branchName: string }
  | { kind: 'stash'; stashRef: string }
  | null

export type GitContextValue = {
  loading: boolean
  error?: string

  currentProject: ProjectGitStatus
  allProjects: ProjectGitStatus[]

  // Aggregated count of branches ahead of the current branch across all projects (UNREAD)
  gitUpdatedBranchesCount: number

  // Per-project unread updated branches count map and accessor
  updatedBranchesCountByProject: Record<string, number>
  getProjectUpdatedBranchesCount: (projectId?: string) => number

  // Unified branches API
  unified: {
    byProject: Record<string, UnifiedBranchesState>
    get: (projectId?: string) => UnifiedBranchesState
    reload: (projectId?: string) => Promise<void>
  }

  // Pending features resolved from commits between baseRef -> headRef
  pending: {
    byProject: Record<string, Record<string, PendingFeatureRefsState>>
    get: (
      projectId: string | undefined,
      baseRef: string,
      headRef: string,
    ) => PendingFeatureRefsState
    load: (projectId: string | undefined, baseRef: string, headRef: string) => Promise<void>
  }

  mergePreferences: MergePreferences

  // Unread helpers for branches
  isBranchUnread: (projectId: string, baseRef: string, branch: GitUnifiedBranch) => boolean
  markBranchSeen: (
    projectId: string,
    baseRef: string,
    branch: GitUnifiedBranch,
    headSha?: string,
  ) => void

  // UI selection state (per project)
  selection: {
    byProject: Record<string, GitSelection>
    get: (projectId?: string) => GitSelection
    selectBranch: (projectId: string | undefined, branchName: string) => void
    selectStash: (projectId: string | undefined, stashRef: string) => void
    clear: (projectId?: string) => void
  }
}

const GitContext = createContext<GitContextValue | null>(null)

// Permissive matcher: supports refs like 'origin/features/<id>' or 'refs/heads/features/<id>'
const getStoryIdFromBranchName = (branchName: string): string | undefined => {
  const match = branchName.match(/(?:^|\/)features\/([0-9a-fA-F-]{8,})/)
  return match ? match[1] : undefined
}

const parseStoryIdFromUnified = (u: GitUnifiedBranch): string | undefined => {
  if (u.storyId) return u.storyId
  const tryParse = (name?: string): string | undefined => {
    if (!name) return undefined
    const m = name.match(/(?:^|\/)features\/([0-9a-fA-F-]{8,})/)
    return m ? m[1] : undefined
  }
  return tryParse(u.name) || tryParse(u.remoteName)
}

const sortUnifiedBranches = (list: GitUnifiedBranch[]) => {
  return [...list].sort((a, b) => {
    if (a.current && !b.current) return -1
    if (b.current && !a.current) return 1
    const aScore = a.isLocal && a.isRemote ? 0 : a.isLocal ? 1 : 2
    const bScore = b.isLocal && b.isRemote ? 0 : b.isLocal ? 1 : 2
    if (aScore !== bScore) return aScore - bScore
    return a.name.localeCompare(b.name)
  })
}

// Local storage helpers for persistent options
const LS_KEYS = {
  autoPush: 'git.merge.autoPush',
  deleteRemote: 'git.merge.deleteRemoteBranch',
}
function readBoolLS(key: string, fallback = false): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}
function writeBoolLS(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {}
}

// LocalStorage for per-branch last-seen head sha keyed by project|base|head
const GIT_LS_PREFIX = 'git:last-seen:'
const GIT_EVT_KEY = 'git-last-seen-changed'
function keyForLastSeen(projectId: string, baseRef: string, headRef: string): string {
  return `${GIT_LS_PREFIX}${projectId}|${baseRef}|${headRef}`
}
function readLastSeen(projectId: string, baseRef: string, headRef: string): string | undefined {
  try {
    return localStorage.getItem(keyForLastSeen(projectId, baseRef, headRef)) || undefined
  } catch {
    return undefined
  }
}
function writeLastSeen(projectId: string, baseRef: string, headRef: string, sha: string) {
  try {
    localStorage.setItem(keyForLastSeen(projectId, baseRef, headRef), sha)
    const ev = new CustomEvent(GIT_EVT_KEY, { detail: { projectId, baseRef, headRef, sha } })
    window.dispatchEvent(ev)
  } catch {}
}

// Resolve effective head ref and sha for a unified branch
function getHeadRef(b: GitUnifiedBranch): string | undefined {
  return b.isLocal ? b.name : b.remoteName || b.name
}
function getHeadSha(b: GitUnifiedBranch): string | undefined {
  return b.isLocal ? b.localSha || b.remoteSha || undefined : b.remoteSha || b.localSha || undefined
}

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, projects } = useProjectContext()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [currentProject, setCurrentProject] = useState<ProjectGitStatus>({
    projectId: activeProjectId,
    pending: [],
  })
  const [allProjects, setAllProjects] = useState<ProjectGitStatus[]>([])

  // Unified branches state per project
  const [unifiedByProject, setUnifiedByProject] = useState<Record<string, UnifiedBranchesState>>({})

  // Pending features by project -> headRefKey (baseRef|headRef)
  const [pendingByProject, setPendingByProject] = useState<
    Record<string, Record<string, PendingFeatureRefsState>>
  >({})

  // UI selection (per project)
  const [selectionByProject, setSelectionByProject] = useState<Record<string, GitSelection>>({})

  // Merge preferences (persisted)
  const [autoPush, setAutoPush] = useState<boolean>(() => readBoolLS(LS_KEYS.autoPush, false))
  const [deleteRemote, setDeleteRemote] = useState<boolean>(() =>
    readBoolLS(LS_KEYS.deleteRemote, false),
  )
  useEffect(() => writeBoolLS(LS_KEYS.autoPush, autoPush), [autoPush])
  useEffect(() => writeBoolLS(LS_KEYS.deleteRemote, deleteRemote), [deleteRemote])

  const mergePreferences = useMemo<MergePreferences>(
    () => ({ autoPush, deleteRemote, setAutoPush, setDeleteRemote }),
    [autoPush, deleteRemote],
  )

  // Debounce timers per project for unified.reload on monitor updates
  const reloadTimersRef = useRef<Record<string, number | ReturnType<typeof setTimeout>>>({})

  const onMonitorUpdate = async (update: { projectId: string; state: GitBranchEvent }) => {
    const { projectId, state: branchUpdate } = update

    setAllProjects((current) => {
      const projectIndex = current.findIndex((p) => p.projectId === projectId)
      if (projectIndex === -1) return current

      const newAllProjects = [...current]
      const newProjectStatus = { ...newAllProjects[projectIndex] }
      newAllProjects[projectIndex] = newProjectStatus

      const newPending = [...newProjectStatus.pending]
      newProjectStatus.pending = newPending

      const branchIdx = newPending.findIndex((b) => b.branch === branchUpdate.name)

      // Only consider feature branches that are ahead (remote-qualified names supported)
      const storyId = getStoryIdFromBranchName(branchUpdate.name)
      const isFeature = !!storyId
      const isUpdated = branchUpdate.ahead > 0 // behind does not matter for badge logic now

      // Reflect the actual current base branch if known from unified state; fallback to 'main'
      const currentBase = unifiedByProject[projectId]?.branches?.find((b) => b.current)?.name

      if (isFeature && isUpdated) {
        const pendingBranch: PendingBranch = {
          projectId,
          branch: branchUpdate.name,
          baseRef: currentBase || 'main',
          repoPath: '', // Not available on the event, handled by backend
          ahead: branchUpdate.ahead,
          behind: branchUpdate.behind,
          storyId,
        }
        if (branchIdx > -1) {
          newPending[branchIdx] = pendingBranch
        } else {
          newPending.push(pendingBranch)
        }
      } else if (branchIdx > -1) {
        newPending.splice(branchIdx, 1)
      }

      return newAllProjects
    })

    // Create a git_changes notification when a feature branch is ahead
    try {
      const storyId = getStoryIdFromBranchName(branchUpdate.name)
      const isFeature = !!storyId
      const isUpdated = branchUpdate.ahead > 0
      const currentBase = unifiedByProject[projectId]?.branches?.find((b) => b.current)?.name
      if (isFeature && isUpdated) {
        // De-duplicate: if there is already an unread git_changes notification
        // for this project+branch+baseRef, do not create a new one (treat as ongoing)
        try {
          const recent = await notificationsService.getRecentNotifications(projectId)
          const baseRef = currentBase || 'main'
          const hasOngoing = (recent || []).some(
            (n) =>
              !n.read &&
              n.category === 'git_changes' &&
              n.metadata &&
              n.metadata.branch === branchUpdate.name &&
              (n.metadata.baseRef || 'main') === baseRef,
          )
          if (!hasOngoing) {
            await notificationsService.create(projectId, {
              type: 'info',
              category: 'git_changes',
              title: 'Branch updated',
              message: `${branchUpdate.name} is ${branchUpdate.ahead} commit${branchUpdate.ahead === 1 ? '' : 's'} ahead of ${baseRef}`,
              metadata: { branch: branchUpdate.name, baseRef },
            })
          }
        } catch (_) {}
      }
    } catch {}

    // Debounce unified reload for this project so UI badge/deltas stay fresh
    try {
      const existing = reloadTimersRef.current[projectId]
      if (typeof existing === 'number') {
        clearTimeout(existing as number)
      } else if (existing) {
        // NodeJS.Timer fallback (should not happen in renderer)
        // @ts-ignore
        clearTimeout(existing)
      }
      // Schedule a lightweight unified reload shortly after the event burst
      const t = setTimeout(() => {
        void loadUnified(projectId)
        // cleanup
        delete reloadTimersRef.current[projectId]
      }, 400)
      // In browsers, setTimeout returns a number; in Node it can be a Timer
      // We store it as any-compatible value
      // @ts-ignore
      reloadTimersRef.current[projectId] = t as any
    } catch {}
  }

  useEffect(() => {
    const unsubscribe = gitService.subscribeToMonitorUpdates(onMonitorUpdate)
    return () => {
      unsubscribe()
      // Clear any outstanding reload timers on unmount
      try {
        const timers = Object.values(reloadTimersRef.current)
        for (const tm of timers) {
          if (typeof tm === 'number') clearTimeout(tm as number)
          // @ts-ignore - clearTimeout can accept Timer in Node typings
          else if (tm) clearTimeout(tm)
        }
      } catch {}
    }
  }, [])

  // Keep a simple list of projects for currentProject/allProjects usage
  useEffect(() => {
    setAllProjects(projects.map((p) => ({ projectId: p.id, pending: [] })))
  }, [projects])

  useEffect(() => {
    const curr = allProjects.find((p) => p.projectId === activeProjectId) || {
      projectId: activeProjectId,
      pending: [],
    }
    setCurrentProject(curr)
  }, [activeProjectId, allProjects])

  // Unified branches loader
  const loadUnified = React.useCallback(
    async (projectId?: string) => {
      const pid = projectId || activeProjectId
      if (!pid) return
      setUnifiedByProject((prev) => ({
        ...prev,
        [pid]: { ...(prev[pid] || { branches: [], stashes: [] }), loading: true, error: undefined },
      }))
      try {
        const [list, stashRes] = await Promise.all([
          gitService.listUnifiedBranches(pid),
          gitService.listStashes(pid).catch(() => ({ stashes: [] }))
        ])
        
        const stashes = stashRes?.stashes || []

        const current = list.find((b) => b.current)
        const currentName = current?.name
        const relToCurrent: Record<string, { ahead: number; behind: number }> = {}
        if (currentName) {
          for (const b of list) {
            if (b.current) continue
            const headRef = b.isLocal ? b.name : b.remoteName || b.name
            if (!headRef || headRef === currentName) continue
            try {
              const [aheadCommits, behindCommits] = await Promise.all([
                gitService.selectCommits(pid, {
                  sources: [headRef],
                  baseRef: currentName,
                  includeMerges: false,
                  maxCount: 1000,
                }),
                gitService.selectCommits(pid, {
                  sources: [currentName],
                  baseRef: headRef,
                  includeMerges: false,
                  maxCount: 1000,
                }),
              ])
              relToCurrent[headRef] = {
                ahead: aheadCommits?.length || 0,
                behind: behindCommits?.length || 0,
              }
            } catch (e) {
              // Degrade gracefully for this branch
              relToCurrent[headRef] = { ahead: 0, behind: 0 }
            }
          }
        }

        const hydrated = list.map((b) => ({
          ...b,
          storyId: b.storyId || parseStoryIdFromUnified(b),
        }))
        const sorted = sortUnifiedBranches(hydrated)
        setUnifiedByProject((prev) => ({
          ...prev,
          [pid]: { loading: false, error: undefined, branches: sorted, stashes, relToCurrent },
        }))
      } catch (e) {
        setUnifiedByProject((prev) => ({
          ...prev,
          [pid]: {
            loading: false,
            error: (e as any)?.message || 'Failed to list branches',
            branches: [],
            stashes: [],
            relToCurrent: {},
          },
        }))
      }
    },
    [activeProjectId],
  )

  // Pending features loader
  const loadPending = React.useCallback(
    async (projectId: string | undefined, baseRef: string, headRef: string) => {
      const pid = projectId || activeProjectId
      if (!pid) return
      const key = `${baseRef}|${headRef}`
      setPendingByProject((prev) => ({
        ...prev,
        [pid]: {
          ...(prev[pid] || {}),
          [key]: { ...(prev[pid]?.[key] || { entries: [] }), loading: true, error: undefined },
        },
      }))
      try {
        // Commits between baseRef -> headRef
        const commits = await gitService.selectCommits(pid, {
          sources: [headRef],
          baseRef,
          includeMerges: true,
          maxCount: 500,
        })

        // Identify story/feature refs from commit messages (backend already sets storyId in unified branches,
        // but this is commit-based discovery for merge modal placeholders)
        const entriesMap = new Map<string, { storyId: string; featureId?: string }>()
        for (const c of commits || []) {
          const storyId = (c as any)?.storyId
          const featureId = (c as any)?.featureId
          if (storyId) entriesMap.set(`${storyId}.${featureId || ''}`, { storyId, featureId })
        }
        const entries = Array.from(entriesMap.values())

        setPendingByProject((prev) => ({
          ...prev,
          [pid]: {
            ...(prev[pid] || {}),
            [key]: { loading: false, error: undefined, entries, commits },
          },
        }))
      } catch (e) {
        setPendingByProject((prev) => ({
          ...prev,
          [pid]: {
            ...(prev[pid] || {}),
            [key]: {
              loading: false,
              error: (e as any)?.message || 'Failed to load pending features',
              entries: [],
              commits: [],
            },
          },
        }))
      }
    },
    [activeProjectId],
  )

  const unifiedApi = useMemo(
    () => ({
      byProject: unifiedByProject,
      get: (projectId?: string) => {
        const pid = projectId || activeProjectId
        return (
          (pid && unifiedByProject[pid]) || {
            loading: false,
            branches: [],
            stashes: [],
            error: pid ? undefined : 'No active project',
          }
        )
      },
      reload: async (projectId?: string) => {
        await loadUnified(projectId)
      },
    }),
    [unifiedByProject, activeProjectId, loadUnified],
  )

  const pendingApi = useMemo(
    () => ({
      byProject: pendingByProject,
      get: (projectId: string | undefined, baseRef: string, headRef: string) => {
        const pid = projectId || activeProjectId
        const key = `${baseRef}|${headRef}`
        if (!pid) return { loading: false, error: 'No active project', entries: [] }
        return pendingByProject[pid]?.[key] || { loading: false, entries: [] }
      },
      load: async (projectId: string | undefined, baseRef: string, headRef: string) => {
        await loadPending(projectId, baseRef, headRef)
      },
    }),
    [pendingByProject, activeProjectId, loadPending],
  )

  // Compute unread updated branches counts per project (based on localStorage last-seen)
  const [seenVersion, setSeenVersion] = useState(0)
  useEffect(() => {
    const handler = () => setSeenVersion((v) => v + 1)
    window.addEventListener(GIT_EVT_KEY, handler as any)
    return () => window.removeEventListener(GIT_EVT_KEY, handler as any)
  }, [])

  const updatedBranchesCountByProject = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [pid, st] of Object.entries(unifiedByProject)) {
      const current = st.branches.find((b) => b.current)
      const baseRef = current?.name || 'main'
      let count = 0
      for (const b of st.branches) {
        if (b.current) continue
        if (!b.isLocal) continue
        if ((st.relToCurrent?.[getHeadRef(b) || '']?.ahead || 0) <= 0) continue
        const headRef = getHeadRef(b)
        if (!headRef) continue
        const sha = getHeadSha(b)
        if (!sha) {
          count++
          continue
        }
        const lastSeen = readLastSeen(pid, baseRef, headRef)
        if (lastSeen !== sha) count++
      }
      out[pid] = count
    }
    return out
  }, [unifiedByProject, seenVersion])

  const gitUpdatedBranchesCountComputed = useMemo(() => {
    return Object.values(updatedBranchesCountByProject).reduce((acc, n) => acc + (n || 0), 0)
  }, [updatedBranchesCountByProject])

  const getProjectUpdatedBranchesCount = React.useCallback(
    (projectId?: string) => {
      const pid = projectId || activeProjectId
      if (!pid) return 0
      return updatedBranchesCountByProject[pid] || 0
    },
    [updatedBranchesCountByProject, activeProjectId],
  )

  const isBranchUnread = React.useCallback(
    (projectId: string, baseRef: string, branch: GitUnifiedBranch): boolean => {
      const st = unifiedByProject[projectId]
      if (!st) return false
      const rel = st.relToCurrent || {}
      const headRef = getHeadRef(branch)
      if (!headRef) return false
      const delta = rel[headRef]
      if (!delta || (delta.ahead || 0) <= 0) return false
      const sha = getHeadSha(branch)
      if (!sha) return true
      const lastSeen = readLastSeen(projectId, baseRef, headRef)
      return lastSeen !== sha
    },
    [unifiedByProject, seenVersion],
  )

  const markBranchSeen = React.useCallback(
    (projectId: string, baseRef: string, branch: GitUnifiedBranch, headSha?: string) => {
      const headRef = getHeadRef(branch)
      const sha = headSha || getHeadSha(branch)
      if (!projectId || !baseRef || !headRef || !sha) return
      writeLastSeen(projectId, baseRef, headRef, sha)
      setSeenVersion((v) => v + 1)
    },
    [],
  )

  const selectionApi = useMemo(
    () => ({
      byProject: selectionByProject,
      get: (projectId?: string): GitSelection => {
        const pid = projectId || activeProjectId
        if (!pid) return null
        return selectionByProject[pid] || null
      },
      selectBranch: (projectId: string | undefined, branchName: string) => {
        const pid = projectId || activeProjectId
        if (!pid) return
        setSelectionByProject((prev) => ({ ...prev, [pid]: { kind: 'branch', branchName } }))
      },
      selectStash: (projectId: string | undefined, stashRef: string) => {
        const pid = projectId || activeProjectId
        if (!pid) return
        setSelectionByProject((prev) => ({ ...prev, [pid]: { kind: 'stash', stashRef } }))
      },
      clear: (projectId?: string) => {
        const pid = projectId || activeProjectId
        if (!pid) return
        setSelectionByProject((prev) => {
          if (!prev[pid]) return prev
          const next = { ...prev }
          delete next[pid]
          return next
        })
      },
    }),
    [selectionByProject, activeProjectId],
  )

  const value = useMemo<GitContextValue>(
    () => ({
      loading,
      error,
      currentProject,
      allProjects,
      gitUpdatedBranchesCount: gitUpdatedBranchesCountComputed,
      updatedBranchesCountByProject,
      getProjectUpdatedBranchesCount,
      unified: unifiedApi,
      pending: pendingApi,
      mergePreferences,
      isBranchUnread,
      markBranchSeen,
      selection: selectionApi,
    }),
    [
      loading,
      error,
      currentProject,
      allProjects,
      gitUpdatedBranchesCountComputed,
      updatedBranchesCountByProject,
      getProjectUpdatedBranchesCount,
      unifiedApi,
      pendingApi,
      mergePreferences,
      isBranchUnread,
      markBranchSeen,
      selectionApi,
    ],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
