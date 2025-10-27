import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
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

export type GitContextValue = {
  loading: boolean
  error?: string

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
  const { activeProjectId } = useProjectContext()
  const [loading] = useState<boolean>(true)
  const [error] = useState<string | undefined>(undefined)

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

  const value = useMemo<GitContextValue>(
    () => ({
      loading,
      error,
      getMergePlan,
      buildMergeReport,
      applyMerge,
      getLocalStatus,
      getBranchDiffSummary,
    }),
    [
      loading,
      error,
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
