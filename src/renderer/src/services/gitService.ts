import {
  ApplyMergeOptions,
  BuildMergeReportOptions,
  DiffSummary,
  GitBranchEvent,
  GitMonitorConfig,
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
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
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
  deleteBranch: (projectId: string, name: string) => Promise<{ ok: boolean; error?: string }>

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
