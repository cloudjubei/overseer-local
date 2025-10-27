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
  deleteBranch: (projectId: string, name: string) => Promise<{ ok: boolean; error?: string }>

  // New ops
  push: (
    projectId: string,
    args: { remote?: string; branch?: string },
  ) => Promise<{ ok: boolean; error?: string; stdout?: string; stderr?: string }>
  deleteRemoteBranch: (
    projectId: string,
    args: { remote?: string; branch: string },
  ) => Promise<{ ok: boolean; error?: string; stdout?: string; stderr?: string }>

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
