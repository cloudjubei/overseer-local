import {
  ApplyMergeOptions,
  BuildMergeReportOptions,
  DiffSummary,
  GitBranchEvent,
  GitMonitorConfig,
  GitOpResult,
  LocalStatus,
  LocalStatusOptions,
  MergePlan,
  MergePlanOptions,
  MergeReport,
  MergeResult,
} from 'thefactory-tools'

export type GitService = {
  getMergePlan: (
    projectId: string,
    options: Omit<MergePlanOptions, 'repoPath'>,
  ) => Promise<MergePlan>
  buildMergeReport: (
    projectId: string,
    plan: MergePlan,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
  applyMerge: (
    projectId: string,
    options: Omit<ApplyMergeOptions, 'repoPath'>,
  ) => Promise<MergeResult>
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
  deleteBranch: (projectId: string, name: string) => Promise<GitOpResult | undefined>
  push: (projectId: string, remote?: string, branch?: string) => Promise<GitOpResult | undefined>
  deleteRemoteBranch: (projectId: string, name: string) => Promise<GitOpResult | undefined>

  startMonitor: (
    projectId: string,
    options: Omit<GitMonitorConfig, 'repoPath' | 'onUpdate' | 'onError'>,
  ) => Promise<void>
  stopMonitor: (projectId: string) => Promise<void>
  subscribeToMonitorUpdates: (
    callback: (payload: { projectId: string; state: GitBranchEvent }) => void,
  ) => () => void
}

export const gitService: GitService = {
  ...window.gitService,
}
