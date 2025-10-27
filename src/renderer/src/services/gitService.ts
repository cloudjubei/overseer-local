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
  getMergePlan: (projectId: string, args: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>
  buildMergeReport: (
    projectId: string,
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
  applyMerge: (projectId: string, options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>
  getLocalStatus: (
    projectId: string,
    options?: Omit<LocalStatusOptions, 'repoPath'>,
  ) => Promise<LocalStatus>
  getBranchDiffSummary: (
    projectId: string,
    options: {
      baseRef: string
      headRef: string
      includePatch?: boolean
    },
  ) => Promise<DiffSummary>
}

export const gitService: GitService = {
  ...window.gitService,
}
