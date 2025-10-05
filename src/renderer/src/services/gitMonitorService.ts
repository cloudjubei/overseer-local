export type GitBranchInfo = {
  name: string
  sha?: string
  lastCommitAt?: string
  current?: boolean
}

export type GitMonitorStatus = {
  ok: boolean
  repoPath: string | null
  branches: GitBranchInfo[]
  currentBranch: string | null
  lastFetchAt: string | null
  lastUpdatedAt: string
  projectId?: string
}

// Mirror core GitTools result types used via IPC
export type GitOpResultOk = { ok: true; stdout?: string }
export type GitOpResultErr = {
  ok: false
  error: string
  stderr?: string
  stdout?: string
  code?: number
}
export type GitOpResult = GitOpResultOk | GitOpResultErr

export type GitStatusPorcelain = {
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

export type GitStatusResult = GitOpResult & { status?: GitStatusPorcelain }
export type GitListRemotesResult = GitOpResult & { remotes?: string[] }
export type GitListBranchesResult = GitOpResult & { branches?: GitBranchInfo[] }
export type GitCurrentBranchResult = GitOpResult & { branch?: string }

export type GitMonitorService = {
  subscribe: (callback: (status: GitMonitorStatus) => void) => () => void
  getStatus: (projectId?: string) => Promise<GitMonitorStatus>
  triggerPoll: (projectId?: string) => Promise<GitMonitorStatus>
  setPollInterval: (ms: number) => Promise<void>
  hasUnmerged: (
    branchName: string,
    baseBranch?: string | null,
    projectId?: string,
  ) => Promise<{
    ok: boolean
    hasUnmerged?: boolean
    aheadCount?: number
    base?: string
    branch?: string
    error?: string
  }>
  mergeBranch: (
    branchName: string,
    baseBranch?: string | null,
    projectId?: string,
  ) => Promise<{
    ok: boolean
    merged?: boolean
    base?: string
    branch?: string
    commit?: string
    reason?: string
    error?: string
  }>
  startAllProjects: () => Promise<void>
  startProject: (projectId: string) => Promise<void>

  // GitTools methods via IPC
  gitStatus: (projectId?: string) => Promise<GitStatusResult>
  listRemotes: (projectId?: string) => Promise<GitListRemotesResult>
  fetch: (projectId?: string, remote?: string) => Promise<GitOpResult>
  pull: (projectId?: string, remote?: string, branch?: string) => Promise<GitOpResult>
  push: (projectId?: string, remote?: string, branch?: string) => Promise<GitOpResult>
  stage: (projectId: string | undefined, path: string) => Promise<GitOpResult>
  stageAll: (projectId?: string) => Promise<GitOpResult>
  reset: (projectId: string | undefined, path: string) => Promise<GitOpResult>
  discard: (projectId: string | undefined, path: string) => Promise<GitOpResult>
  pushAll: (projectId: string | undefined, message: string) => Promise<{ ok: true }>
  createBranch: (
    projectId: string | undefined,
    name: string,
    checkoutAfter?: boolean,
  ) => Promise<GitOpResult>
  checkoutBranch: (
    projectId: string | undefined,
    name: string,
    create: boolean,
  ) => Promise<GitOpResult>
  deleteBranch: (projectId: string | undefined, name: string) => Promise<GitOpResult>
  renameBranch: (
    projectId: string | undefined,
    oldName: string,
    newName: string,
  ) => Promise<GitOpResult>
  setUpstream: (
    projectId: string | undefined,
    remote?: string,
    branch?: string,
  ) => Promise<GitOpResult>
  listBranches: (projectId?: string) => Promise<GitListBranchesResult>
  getCurrentBranch: (projectId?: string) => Promise<GitCurrentBranchResult>
}

export const gitMonitorService: GitMonitorService = { ...(window as any).gitMonitorService }
