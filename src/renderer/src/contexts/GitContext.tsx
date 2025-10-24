import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import type {
  MergePlan,
  MergePlanOptions,
  BuildMergeReportOptions,
  MergeReport,
  ApplyMergeOptions,
  MergeResult,
  LocalStatusOptions,
  LocalStatus,
  DiffSummary,
} from '../../../logic/git/gitTypes.copy'

export type PendingBranchSummary = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  ahead: number
  behind: number
  storyId?: string
  featureId?: string
  totals?: { insertions: number; deletions: number; filesChanged: number }
}

export type ProjectGitSummary = {
  projectId: string
  repoPath?: string
  baseRef?: string
  pending: PendingBranchSummary[]
  error?: string
}

export type GitContextValue = {
  // Data/state
  loading: boolean
  error?: string
  currentProject?: ProjectGitSummary
  allProjects: ProjectGitSummary[]
  pendingAll: PendingBranchSummary[]
  pendingCurrent: PendingBranchSummary[]

  // Refreshers
  refresh: () => Promise<void>
  refreshCurrent: () => Promise<void>
  refreshAll: () => Promise<void>

  // Actions that delegate to gitService
  getMergePlan: (args: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>
  buildMergeReport: (
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
  applyMerge: (options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>
  getLocalStatus: (options?: Omit<LocalStatusOptions, 'repoPath'>) => Promise<LocalStatus>
  getBranchDiffSummary: (options: { baseRef: string; headRef: string; includePatch?: boolean }) => Promise<DiffSummary>
}

const GitContext = createContext<GitContextValue | null>(null)

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId } = useProjectContext()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [currentProject, setCurrent] = useState<ProjectGitSummary | undefined>(undefined)
  const [allProjects, setAll] = useState<ProjectGitSummary[]>([])

  const refreshCurrent = useCallback(async () => {
    try {
      if (activeProjectId) {
        const { projects } = await gitService.todo(activeProjectId)
        setCurrent(projects?.[0])
      } else {
        setCurrent(undefined)
      }
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
  }, [activeProjectId])

  const refreshAll = useCallback(async () => {
    try {
      const { projects: all } = await gitService.todo()
      setAll(all || [])
    } catch (err: any) {
      setError(err?.message ?? String(err))
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      await Promise.all([refreshCurrent(), refreshAll()])
    } finally {
      setLoading(false)
    }
  }, [refreshCurrent, refreshAll])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Derived state
  const pendingCurrent = useMemo(() => currentProject?.pending || [], [currentProject])
  const pendingAll = useMemo(() => allProjects.flatMap((p) => p.pending || []), [allProjects])

  // Action wrappers
  const getMergePlan = useCallback(
    (args: Omit<MergePlanOptions, 'repoPath'>) => gitService.getMergePlan(args),
    [],
  )

  const buildMergeReport = useCallback(
    (
      planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
      options?: BuildMergeReportOptions,
    ) => gitService.buildMergeReport(planOrOptions as any, options),
    [],
  )

  const applyMerge = useCallback(
    (options: Omit<ApplyMergeOptions, 'repoPath'>) => gitService.applyMerge(options),
    [],
  )

  const getLocalStatus = useCallback(
    (options?: Omit<LocalStatusOptions, 'repoPath'>) => gitService.getLocalStatus(options),
    [],
  )

  const getBranchDiffSummary = useCallback(
    (options: { baseRef: string; headRef: string; includePatch?: boolean }) =>
      gitService.getBranchDiffSummary(options),
    [],
  )

  const value = useMemo<GitContextValue>(
    () => ({
      // data
      loading,
      error,
      currentProject,
      allProjects,
      pendingAll,
      pendingCurrent,
      // refreshers
      refresh,
      refreshCurrent,
      refreshAll,
      // actions
      getMergePlan,
      buildMergeReport,
      applyMerge,
      getLocalStatus,
      getBranchDiffSummary,
    }),
    [
      loading,
      error,
      currentProject,
      allProjects,
      pendingAll,
      pendingCurrent,
      refresh,
      refreshCurrent,
      refreshAll,
      getMergePlan,
      buildMergeReport,
      applyMerge,
      getLocalStatus,
      getBranchDiffSummary,
    ],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
