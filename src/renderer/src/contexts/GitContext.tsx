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

export type GitContextValue = {
  loading: boolean
  error?: string

  getMergePlan: (args: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>
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
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | undefined>(undefined)

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
