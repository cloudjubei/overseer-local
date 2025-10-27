import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import {
  ApplyMergeOptions,
  BuildMergeReportOptions,
  DiffSummary,
  GitBranchEvent,
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
  deleteBranch: (name: string) => Promise<{ ok: boolean; error?: string }>

  // Project-scoped variants for cross-project lists
  applyMergeOn: (
    projectId: string,
    options: Omit<ApplyMergeOptions, 'repoPath'>,
  ) => Promise<MergeResult>
  getBranchDiffSummaryOn: (
    projectId: string,
    options: { baseRef: string; headRef: string; includePatch?: boolean },
  ) => Promise<DiffSummary>
  deleteBranchOn: (projectId: string, name: string) => Promise<{ ok: boolean; error?: string }>

  // Newly added project-scoped helpers for planning/reporting
  getMergePlanOn: (
    projectId: string,
    options: Omit<MergePlanOptions, 'repoPath'>,
  ) => Promise<MergePlan>
  buildMergeReportOn: (
    projectId: string,
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
}

const GitContext = createContext<GitContextValue | null>(null)

const getStoryIdFromBranchName = (branchName: string): string | undefined => {
  const match = branchName.match(/^features\/([0-9a-fA-F-]+)/)
  return match ? match[1] : undefined
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

  // Core git operations proxied to main via preload
  const getMergePlan = useCallback(
    (options: Omit<MergePlanOptions, 'repoPath'>) =>
      gitService.getMergePlan(activeProjectId, options),
    [activeProjectId],
  )

  const buildMergeReport = useCallback(
    (plan: MergePlan, options?: BuildMergeReportOptions) =>
      gitService.buildMergeReport(activeProjectId, plan, options),
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

  const deleteBranch = useCallback(
    (name: string) => gitService.deleteBranch(activeProjectId, name),
    [activeProjectId],
  )

  // project-scoped variants for cross-project rows
  const applyMergeOn = useCallback(
    (projectId: string, options: Omit<ApplyMergeOptions, 'repoPath'>) =>
      gitService.applyMerge(projectId, options),
    [],
  )
  const getBranchDiffSummaryOn = useCallback(
    (projectId: string, options: { baseRef: string; headRef: string; includePatch?: boolean }) =>
      gitService.getBranchDiffSummary(projectId, options),
    [],
  )
  const deleteBranchOn = useCallback(
    (projectId: string, name: string) => gitService.deleteBranch(projectId, name),
    [],
  )

  // newly added project-scoped helpers for planning/reporting
  const getMergePlanOn = useCallback(
    (projectId: string, options: Omit<MergePlanOptions, 'repoPath'>) =>
      gitService.getMergePlan(projectId, options),
    [],
  )

  const buildMergeReportOn = useCallback(
    (
      projectId: string,
      planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
      options?: BuildMergeReportOptions,
    ) => gitService.buildMergeReport(projectId, planOrOptions, options),
    [],
  )

  const onMonitorUpdate = async (update: { projectId: string; state: GitBranchEvent }) => {
    console.log('GitContext onMonitorUpdate update: ', update)
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

      if (branchUpdate.ahead > 0) {
        const pendingBranch: PendingBranch = {
          projectId,
          branch: branchUpdate.name,
          baseRef: 'main', // Assumes the base branch from monitor config
          repoPath: '', // Not available on the event, handled by backend
          ahead: branchUpdate.ahead,
          behind: branchUpdate.behind,
          storyId: getStoryIdFromBranchName(branchUpdate.name),
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
  }, [onMonitorUpdate])

  useEffect(() => {
    if (loading) return
    setLoading(true)

    setAllProjects(projects.map((p) => ({ projectId: p.id, pending: [] })))
    console.log('Starting gitContext with projects: ', projects)

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
  }, [])

  useEffect(() => {
    const curr = allProjects.find((p) => p.projectId === activeProjectId) || {
      projectId: activeProjectId,
      pending: [],
    }
    setCurrentProject(curr)
  }, [activeProjectId, allProjects])

  const refresh = useCallback(async () => {
    // This is now a no-op as the context is live.
    // The useEffect hook handles setup and updates automatically.
  }, [])

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
      deleteBranch,
      applyMergeOn,
      getBranchDiffSummaryOn,
      deleteBranchOn,
      getMergePlanOn,
      buildMergeReportOn,
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
      deleteBranch,
      applyMergeOn,
      getBranchDiffSummaryOn,
      deleteBranchOn,
      getMergePlanOn,
      buildMergeReportOn,
    ],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
