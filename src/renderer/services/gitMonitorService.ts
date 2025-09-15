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
  setPollInterval: (ms: number) => Promise<{ ok: boolean; ms: number }>
}

export const gitMonitorService: GitMonitorService = { ...window.gitMonitorService }
