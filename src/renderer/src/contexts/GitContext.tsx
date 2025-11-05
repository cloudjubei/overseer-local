import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import { GitCommitInfo, GitBranchEvent, GitUnifiedBranch } from 'thefactory-tools'

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
}

export type PendingFeatureRefsState = {
  loading: boolean
  error?: string
  entries: Array<{ storyId: string; featureId?: string }>
  commits?: GitCommitInfo[]
}

export type GitContextValue = {
  loading: boolean
  error?: string

  currentProject: ProjectGitStatus
  allProjects: ProjectGitStatus[]

  // Aggregated count of updated feature branches across all projects
  gitUpdatedBranchesCount: number

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
}

const GitContext = createContext<GitContextValue | null>(null)

const getStoryIdFromBranchName = (branchName: string): string | undefined => {
  const match = branchName.match(/^features\/([0-9a-fA-F-]+)/)
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

      // Only consider feature branches that are ahead and not behind their base
      const storyId = getStoryIdFromBranchName(branchUpdate.name)
      const isFeature = !!storyId
      const isUpdated = branchUpdate.ahead > 0 && branchUpdate.behind === 0

      if (isFeature && isUpdated) {
        const pendingBranch: PendingBranch = {
          projectId,
          branch: branchUpdate.name,
          baseRef: 'main', // Assumes the base branch from monitor config
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
  }
  useEffect(() => {
    const unsubscribe = gitService.subscribeToMonitorUpdates(onMonitorUpdate)
    return () => {
      unsubscribe()
    }
  }, [])

  // Initialize projects and start monitors
  useEffect(() => {
    if (loading) return
    setLoading(true)

    setAllProjects(projects.map((p) => ({ projectId: p.id, pending: [] })))

    const load = async () => {
      try {
        await Promise.all(
          projects.map((p) =>
            gitService.startMonitor(p.id, {
              baseBranch: 'main',
              // branchFilter: (branch) => branch.startsWith('features/'), //TODO: passing this via ipc doesn't work
            }),
          ),
        )
      } catch (e) {
        console.error('GitContext error: ', e)
        setError((e as any)?.message || String(e))
      } finally {
        setLoading(false)
      }
    }

    load()
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
        [pid]: { ...(prev[pid] || { branches: [] }), loading: true, error: undefined },
      }))
      try {
        const list = await gitService.listUnifiedBranches(pid)
        const hydrated = list.map((b) => ({
          ...b,
          storyId: b.storyId || parseStoryIdFromUnified(b),
        }))
        const sorted = sortUnifiedBranches(hydrated)
        setUnifiedByProject((prev) => ({
          ...prev,
          [pid]: { loading: false, error: undefined, branches: sorted },
        }))
      } catch (e) {
        setUnifiedByProject((prev) => ({
          ...prev,
          [pid]: {
            loading: false,
            error: (e as any)?.message || 'Failed to list branches',
            branches: [],
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
      if (!pid || !headRef || !baseRef) return
      const key = `${baseRef}|${headRef}`

      // Set loading state
      setPendingByProject((prev) => ({
        ...prev,
        [pid]: {
          ...(prev[pid] || {}),
          [key]: { ...(prev[pid]?.[key] || { entries: [] }), loading: true, error: undefined },
        },
      }))

      try {
        const commits = await gitService.selectCommits(pid, {
          sources: [headRef],
          baseRef,
          includeMerges: false,
          featureInfo: { enableHeuristics: true },
          maxCount: 200,
        })
        // Build unique feature/story pairs from commits
        const uniq = new Map<string, { storyId: string; featureId?: string }>()
        for (const c of commits) {
          const info = c.featureInfo
          const storyId = info?.storyId
          if (!storyId) continue
          const featureId = info?.featureId
          const dep = featureId || storyId
          if (!uniq.has(dep)) uniq.set(dep, { storyId, featureId })
        }
        setPendingByProject((prev) => ({
          ...prev,
          [pid]: {
            ...(prev[pid] || {}),
            [key]: {
              loading: false,
              error: undefined,
              entries: Array.from(uniq.values()),
              commits,
            },
          },
        }))
      } catch (e) {
        setPendingByProject((prev) => ({
          ...prev,
          [pid]: {
            ...(prev[pid] || {}),
            [key]: {
              loading: false,
              error: (e as any)?.message || 'Failed to load pending commits',
              entries: [],
            },
          },
        }))
      }
    },
    [activeProjectId],
  )

  // Refresh unified branches whenever projects change (initial load for all)
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const initial: Record<string, UnifiedBranchesState> = {}
      for (const p of projects) initial[p.id] = { loading: true, branches: [] }
      setUnifiedByProject(initial)
      // Load sequentially to avoid overloading IPC
      for (const p of projects) {
        if (cancelled) break
        await loadUnified(p.id)
      }
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [projects, loadUnified])

  const unifiedApi = useMemo(
    () => ({
      byProject: unifiedByProject,
      get: (projectId?: string): UnifiedBranchesState => {
        const pid = projectId || activeProjectId
        if (!pid) return { loading: false, branches: [] }
        return unifiedByProject[pid] || { loading: true, branches: [] }
      },
      reload: loadUnified,
    }),
    [unifiedByProject, activeProjectId, loadUnified],
  )

  const pendingApi = useMemo(
    () => ({
      byProject: pendingByProject,
      get: (
        projectId: string | undefined,
        baseRef: string,
        headRef: string,
      ): PendingFeatureRefsState => {
        const pid = projectId || activeProjectId
        if (!pid) return { loading: false, entries: [] }
        const key = `${baseRef}|${headRef}`
        return pendingByProject[pid]?.[key] || { loading: false, entries: [] }
      },
      load: loadPending,
    }),
    [pendingByProject, activeProjectId, loadPending],
  )

  const value = useMemo<GitContextValue>(
    () => ({
      loading,
      error,
      currentProject,
      allProjects,
      gitUpdatedBranchesCount: allProjects.reduce((acc, p) => acc + p.pending.length, 0),
      unified: unifiedApi,
      pending: pendingApi,
      mergePreferences,
    }),
    [loading, error, currentProject, allProjects, unifiedApi, pendingApi, mergePreferences],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
