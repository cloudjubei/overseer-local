import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import {
  ApplyMergeOptions,
  BuildMergeReportOptions,
  DiffSummary,
  LocalStatus,
  LocalStatusOptions,
  MergePlan,
  MergePlanOptions,
  MergeReport,
  MergeResult,
} from 'thefactory-tools'

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

export type GitContextValue = {
  loading: boolean
  error?: string

  currentProject: ProjectGitStatus
  allProjects: ProjectGitStatus[]
  refresh: () => Promise<void>

  getMergePlan: (options: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>
  buildMergeReport: (
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
  applyMerge: (options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>
  getLocalStatus: (options?: Omit<LocalStatusOptions, 'repoPath'>) => Promise<LocalStatus>
  getBranchDiffSummary: (options: {
    baseRef: string
    headRef: string
    includePatch?: boolean
  }) => Promise<DiffSummary>
}

const GitContext = createContext<GitContextValue | null>(null)

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, projects } = useProjectContext()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [currentProject, setCurrentProject] = useState<ProjectGitStatus>({
    projectId: activeProjectId,
    pending: [],
  })
  const [allProjects, setAllProjects] = useState<ProjectGitStatus[]>([])

  // Core git operations proxied to main via preload
  const getMergePlan = useCallback(
    (options: Omit<MergePlanOptions, 'repoPath'>) =>
      gitService.getMergePlan(activeProjectId, options),
    [activeProjectId],
  )

  const buildMergeReport = useCallback(
    (
      planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
      options?: BuildMergeReportOptions,
    ) => gitService.buildMergeReport(activeProjectId, planOrOptions as any, options),
    [activeProjectId],
  )

  const applyMerge = useCallback(
    (options: Omit<ApplyMergeOptions, 'repoPath'>) =>
      gitService.applyMerge(activeProjectId, options),
    [activeProjectId],
  )

  const getLocalStatus = useCallback(
    (options?: Omit<LocalStatusOptions, 'repoPath'>) =>
      gitService.getLocalStatus(activeProjectId, options),
    [activeProjectId],
  )

  const getBranchDiffSummary = useCallback(
    (options: { baseRef: string; headRef: string; includePatch?: boolean }) =>
      gitService.getBranchDiffSummary(activeProjectId, options),
    [activeProjectId],
  )

  // Data fetcher: currently provides empty pending arrays (degrades gracefully)
  // and validates connectivity by attempting a lightweight local status call per project when possible.
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      // Attempt a quick status call for the active project to surface errors early
      try {
        await gitService.getLocalStatus(activeProjectId, {})
      } catch (e: any) {
        // Do not hard fail the whole view; record the error message
        setError(e?.message || String(e))
      }

      // Build empty pending states for all known projects (we will enrich in subsequent iterations)
      const perProject: ProjectGitStatus[] = projects.map((p) => ({
        projectId: p.id,
        pending: [],
      }))

      setAllProjects(perProject)
      const curr = perProject.find((p) => p.projectId === activeProjectId) || {
        projectId: activeProjectId,
        pending: [],
      }
      setCurrentProject(curr)
    } finally {
      setLoading(false)
    }
  }, [activeProjectId, projects])

  // Refresh on mount and when active project changes
  useEffect(() => {
    refresh().catch((e) => setError(e?.message || String(e)))
  }, [refresh])

  const value = useMemo<GitContextValue>(
    () => ({
      loading,
      error,
      currentProject,
      allProjects,
      refresh,
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
      refresh,
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
