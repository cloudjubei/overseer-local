import {
  ApplyMergeOptions,
  DiffSummary,
  GitBranchEvent,
  GitMonitorConfig,
  GitOpResult,
  LocalStatus,
  LocalStatusOptions,
  MergePlan,
  MergePlanOptions,
  MergeReport,
  MergeReportOptions,
  MergeResult,
  GitUnifiedBranch,
} from 'thefactory-tools'

export type GitService = {
  getMergePlan: (
    projectId: string,
    options: Omit<MergePlanOptions, 'repoPath'>,
  ) => Promise<MergePlan>
  buildMergeReport: (
    projectId: string,
    plan: MergePlan,
    options?: MergeReportOptions,
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

  listUnifiedBranches: (projectId: string) => Promise<GitUnifiedBranch[]>
}

export const gitService: GitService = {
  ...window.gitService,
}
