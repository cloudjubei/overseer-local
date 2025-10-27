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

export type GitService = {
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

export const gitService: GitService = {
  ...window.gitService,
}
