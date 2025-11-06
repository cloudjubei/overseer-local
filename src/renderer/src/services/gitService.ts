import type {
  GitApplyMergeOptions,
  GitDiffSummary,
  GitBranchEvent,
  GitMonitorConfig,
  GitOpResult,
  GitLocalStatus,
  GitLocalStatusOptions,
  GitMergePlan,
  GitMergePlanOptions,
  GitMergeReport,
  GitMergeReportOptions,
  GitMergeResult,
  GitUnifiedBranch,
  GitCommitInfo,
  GitSelectCommitsOptions,
  GitCommitInput,
  GitFileChange,
} from 'thefactory-tools'

export type GitService = {
  getMergePlan: (
    projectId: string,
    options: Omit<GitMergePlanOptions, 'repoPath'>,
  ) => Promise<GitMergePlan>
  buildMergeReport: (
    projectId: string,
    plan: GitMergePlan,
    options?: GitMergeReportOptions,
  ) => Promise<GitMergeReport>
  applyMerge: (
    projectId: string,
    options: Omit<GitApplyMergeOptions, 'repoPath'>,
  ) => Promise<GitMergeResult>
  getLocalStatus: (
    projectId: string,
    options?: Omit<GitLocalStatusOptions, 'repoPath'>,
  ) => Promise<GitLocalStatus>
  getLocalDiffSummary: (
    projectId: string,
    options?: { staged?: boolean; includePatch?: boolean; includeStructured?: boolean },
  ) => Promise<GitFileChange[]>
  getBranchDiffSummary: (
    projectId: string,
    options: {
      baseRef: string
      headRef: string
      incomingOnly?: boolean
      includePatch?: boolean
    },
  ) => Promise<GitDiffSummary>
  deleteBranch: (projectId: string, name: string) => Promise<GitOpResult | undefined>
  push: (projectId: string, remote?: string, branch?: string) => Promise<GitOpResult | undefined>
  pull: (projectId: string, remote?: string, branch?: string) => Promise<GitOpResult | undefined>
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
  selectCommits: (
    projectId: string,
    options: Omit<GitSelectCommitsOptions, 'repoPath'>,
  ) => Promise<GitCommitInfo[]>
  checkout: (projectId: string, name: string) => Promise<GitOpResult | undefined>

  stage: (projectId: string, paths: string[]) => Promise<GitOpResult | undefined>
  unstage: (projectId: string, paths: string[]) => Promise<GitOpResult | undefined>
  reset: (projectId: string, paths: string[]) => Promise<GitOpResult | undefined>
  commit: (projectId: string, input: GitCommitInput) => Promise<GitOpResult | undefined>
}

export const gitService: GitService = {
  ...window.gitService,
}
