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
}

export type GitMonitorService = {
  subscribe: (callback: (status: GitMonitorStatus) => void) => () => void
  getStatus: () => Promise<GitMonitorStatus>
  triggerPoll: () => Promise<GitMonitorStatus>
  setPollInterval: (ms: number) => Promise<void>
  hasUnmerged: (
    branchName: string,
    baseBranch?: string | null,
  ) => Promise<{ ok: boolean; hasUnmerged?: boolean; aheadCount?: number; base?: string; branch?: string; error?: string }>
  mergeBranch: (
    branchName: string,
    baseBranch?: string | null,
  ) => Promise<{ ok: boolean; merged?: boolean; base?: string; branch?: string; commit?: string; reason?: string; error?: string }>
}

export const gitMonitorService: GitMonitorService = { ...(window as any).gitMonitorService }
