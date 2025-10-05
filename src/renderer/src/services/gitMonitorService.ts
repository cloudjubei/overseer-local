export type GitBranchInfo = {
  name: string
  sha: string
  lastCommitAt?: string
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
}

export const gitMonitorService: GitMonitorService = { ...(window as any).gitMonitorService }
