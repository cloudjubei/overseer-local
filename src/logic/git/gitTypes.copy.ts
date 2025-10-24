export type GitOpResult =
  | { ok: true; stdout?: string }
  | { ok: false; error: string; stderr?: string; stdout?: string; code?: number }

// Unified git exec types
export type GitExecResult = { code: number; stdout: string; stderr: string }
export type GitExecOptions = { timeoutMs?: number }

export type GitStatusPorcelain = {
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

export type GitBranchInfo = {
  name: string
  current?: boolean
}

export type GitTools = {
  init(): Promise<void>
  status(): Promise<GitOpResult & { status?: GitStatusPorcelain }>
  listRemotes(): Promise<GitOpResult & { remotes?: string[] }>
  fetch(remote?: string): Promise<GitOpResult>
  pull(remote?: string, branch?: string): Promise<GitOpResult>
  push(remote?: string, branch?: string): Promise<GitOpResult>
  stage(path: string): Promise<GitOpResult>
  stageAll(): Promise<GitOpResult>
  reset(path: string): Promise<GitOpResult>
  discard(path: string): Promise<GitOpResult>
  pushAll(message: string): Promise<void>
  createBranch(name: string, checkoutAfter?: boolean): Promise<GitOpResult>
  checkoutBranch(name: string, create: boolean): Promise<GitOpResult>
  deleteBranch(name: string): Promise<GitOpResult>
  renameBranch(oldName: string, newName: string): Promise<GitOpResult>
  setUpstream(remote?: string, branch?: string): Promise<GitOpResult>
  listBranches(): Promise<GitOpResult & { branches?: GitBranchInfo[] }>
  getCurrentBranch(): Promise<GitOpResult & { branch?: string }>

  // From GitMonitorTools
  startMonitor: (config: Omit<GitMonitorConfig, 'repoPath'>) => GitMonitor
  getBranchDiffSummary: (args: {
    baseRef: string
    headRef: string
    includePatch?: boolean
  }) => Promise<DiffSummary>
  resolveChangesToStories: (args: {
    baseRef: string
    headRef: string
    resolvers?: StoryResolver | StoryResolver[]
    diff?: DiffSummary
  }) => Promise<{ groups: StoryFeatureChange[] }>

  buildBranchReport: (args: {
    repoPath: string
    baseRef: string
    headRef: string
    includePatch?: boolean
    includeMetrics?: boolean
    storyResolver?: StoryResolver
    metricsProvider?: MetricsProvider
  }) => Promise<BranchReport>
  buildWorkspaceReport: (args: {
    repoPath: string
    baseRef: string
    branches: string[]
    includePatch?: boolean
    includeMetrics?: boolean
    storyResolver?: StoryResolver
    metricsProvider?: MetricsProvider
  }) => Promise<WorkspaceReport>

  // Review ops from GitMonitorTools
  acceptFiles: (files: string[]) => Promise<void>
  rejectFiles: (baseRef: string, files: string[]) => Promise<void>
  resetFiles: (files?: string[]) => Promise<void>
  commitSelection: (args: {
    repoPath: string
    message: string
    signoff?: boolean
    trailers?: Record<string, string> | string[]
  }) => Promise<void>

  // From GitMergeTools
  getMergePlan: (options: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>
  applyMerge: (options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>
  buildMergeReport: (plan: MergePlan, options?: BuildMergeReportOptions) => MergeReport
  getLocalStatus: (options?: Omit<LocalStatusOptions, 'repoPath'>) => Promise<LocalStatus>
  selectCommits: (options: Omit<SelectCommitsOptions, 'repoPath'>) => Promise<CommitInfo[]>
  planCherryPick: (options: Omit<PlanCherryPickOptions, 'repoPath'>) => Promise<MergePlan>
  applyCherryPick: (options: Omit<ApplyCherryPickOptions, 'repoPath'>) => Promise<MergeResult>
  fetchRefs: (options?: Omit<FetchRefsOptions, 'repoPath'>) => Promise<FetchRefsResult>
}

export type GithubCredentials = {
  name: string
  username: string
  email: string
  token: string
}

/*
  Types for GitMergeTools. Focused on merge planning, application, and reporting.
  These types are designed to be JSON-serializable for remote-friendly usage.

  Schema and versioning:
  - SCHEMA_VERSION reflects the current serialization contract for merge plans, results and reports.
  - Any backward-incompatible change to the shapes below MUST bump SCHEMA_VERSION and document migration notes.
*/

/** Git change status for a file relative to a diff: Added, Modified, Deleted, Renamed. */
export type ChangeStatus = 'A' | 'M' | 'D' | 'R'

/** Optional structured patch representation for future expansion. */
export type PatchHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header?: string
  lines: string[]
}

/** Per-file change entry describing how a file will change relative to base. */
export type FileChange = {
  path: string
  status: ChangeStatus
  additions?: number
  deletions?: number
  renameFrom?: string
  renameScore?: number
  patch?: string
  patchHunks?: PatchHunk[]
  patchTruncated?: boolean
  binary?: boolean
  submodule?: boolean
}

/** Porcelain-style summary of the local repository state. */
export type LocalStatus = {
  staged: string[]
  unstaged: string[]
  untracked: string[]
  ignored?: string[]
}

/** Per-path impact entry showing how a planned change intersects with local edits. */
export type ImpactOnLocalEntry = {
  path: string
  plannedStatus: ChangeStatus
  local: 'staged' | 'unstaged' | 'both' | 'untracked'
  risk?: 'overwrite' | 'conflict'
}

/** Impact analysis summarizing overlap between the plan and local working tree changes. */
export type ImpactOnLocal = {
  entries: ImpactOnLocalEntry[]
  untrackedOverwrite: string[]
}

/** Merge plan describing the forecasted changes between the base ref and the merged result of the sources. */
export type MergePlan = {
  schemaVersion: string
  repoPath: string
  baseRef: string
  sources: string[]
  files: FileChange[]
  totals: { insertions: number; deletions: number; filesChanged: number }
  patchesTruncated?: boolean
  impactOnLocal?: ImpactOnLocal
}

/** Options for computing a merge plan. */
export type MergePlanOptions = {
  repoPath: string
  sources: string[]
  baseRef?: string
  includePatch?: boolean
  maxPatchedFiles?: number
  maxPatchBytes?: number
  planMode?: 'worktree' | 'merge-tree'
}

/** Options for reading local status. Used in impact analysis and UI displays. */
export type LocalStatusOptions = {
  repoPath: string
  includeIgnored?: boolean
}

// Merge application result types

/** Conflict kinds mapped from git porcelain two-letter status codes. */
export type ConflictType =
  | 'both_modified'
  | 'both_added'
  | 'both_deleted'
  | 'deleted_by_us'
  | 'deleted_by_them'
  | 'added_by_us'
  | 'added_by_them'

/** A conflict entry indicating a path and the type of conflict encountered. */
export type ConflictEntry = {
  path: string
  type: ConflictType
}

/** Options for applying a merge into the current working tree. */
export type ApplyMergeOptions = {
  repoPath: string
  sources: string[]
  baseRef?: string
  strategy?: string
  allowFastForward?: boolean
  noCommit?: boolean
  createMergeCommit?: boolean
  signoff?: boolean
  autoStash?: boolean
  includeUntrackedInStash?: boolean
  confirmWhenDirty?: boolean
  dryRun?: boolean
}

/** Result of attempting to apply a merge or cherry-pick. */
export type MergeResult = {
  ok: boolean
  mergeCommit?: string
  fastForward?: boolean
  conflicts?: ConflictEntry[]
  stashed?: boolean
  restoredStash?: boolean
  aborted?: boolean
  message?: string
}

// =====================
// Merge Report types
// =====================

/** Options controlling patch inclusion and limits in buildMergeReport. */
export type BuildMergeReportOptions = {
  includePatch?: boolean
  maxPatchedFiles?: number
  maxPatchBytes?: number
}

/** Per-file entry in a merge report. Mirrors FileChange with patch body treated by report limits. */
export type MergeReportFile = {
  path: string
  status: ChangeStatus
  additions?: number
  deletions?: number
  renameFrom?: string
  renameScore?: number
  binary?: boolean
  submodule?: boolean
  patch?: string
  patchTruncated?: boolean
}

/** A versioned, JSON-serializable report suitable for client display. */
export type MergeReport = {
  schemaVersion: string
  kind: 'merge-report'
  generatedAt: number
  repoPath: string
  baseRef: string
  sources: string[]
  totals: { insertions: number; deletions: number; filesChanged: number }
  files: MergeReportFile[]
  conflicts?: ConflictEntry[]
  impactOnLocal?: ImpactOnLocal
  patchesTruncated?: boolean
}

// =====================
// Cherry-pick helpers
// =====================

/** Lightweight commit descriptor for cherry-pick planning UIs. */
export type CommitInfo = {
  sha: string
  parents: string[]
  summary: string
  authorName?: string
  authorEmail?: string
  authorDate?: number
}

/** Options for selecting commits unique to sources vs a base (e.g., for cherry-pick planning UIs). */
export type SelectCommitsOptions = {
  repoPath: string
  sources: string[]
  baseRef?: string
  includeMerges?: boolean
  maxCount?: number
}

/** Options for planning a cherry-pick. */
export type PlanCherryPickOptions = {
  repoPath: string
  commits: string[]
  baseRef?: string
  includePatch?: boolean
  maxPatchedFiles?: number
  maxPatchBytes?: number
  planMode?: 'worktree' | 'merge-tree'
}

/** Options for applying a cherry-pick into the current working tree. */
export type ApplyCherryPickOptions = {
  repoPath: string
  commits: string[]
  signoff?: boolean
  noCommit?: boolean
  autoStash?: boolean
  includeUntrackedInStash?: boolean
  confirmWhenDirty?: boolean
  dryRun?: boolean
}

// =====================
// Opt-in Fetch helper
// =====================

/** Options for explicitly fetching remote refs. */
export type FetchRefsOptions = {
  repoPath: string
  remote?: string
  refs?: string[]
  prune?: boolean
  tags?: boolean
}

/** Result of fetchRefs, indicating updated refs and pruned count, or an error. */
export type FetchRefsResult =
  | {
      ok: true
      remote: string
      fetched: string[]
      pruned: number
      stdout?: string
    }
  | {
      ok: false
      error: string
      code?: number
      stderr?: string
      stdout?: string
    }

// =====================
// GitMonitor / Reports types
// =====================

/** One-letter file status codes reported by git for monitoring summaries. */
export type GitFileStatus = 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | '?' | '!' | 'X'

/** File-level change entry returned in diff summaries and reports. */
export type GitFileChange = {
  path: string
  status: GitFileStatus
  additions?: number
  deletions?: number
  oldPath?: string
}

/** Summary of differences between a base ref and a head ref. */
export type DiffSummary = {
  baseRef: string
  headRef: string
  files: GitFileChange[]
  insertions: number
  deletions: number
  patch?: string
}

/** Optional story/feature identifiers that can be associated with a change group. */
export type StoryFeatureMeta = {
  storyId?: string
  featureId?: string
}

/** Change grouping for a story and/or feature with summary stats. */
export type StoryFeatureChange = StoryFeatureMeta & {
  files: GitFileChange[]
  summary: { insertions: number; deletions: number }
}

/** Optional test and coverage metrics that can be attached to reports or events. */
export type GitMetrics = {
  tests?: { total: number; passed: number; failed: number; skipped?: number }
  coverage?: {
    pct_statements: number
    pct_branch: number | null
    pct_functions: number | null
    pct_lines: number
  }
  summaryText?: string
  providerName?: string
}

/** Minimal per-branch state tracked by the monitor; JSON-serializable. */
export type GitBranchState = {
  name: string
  commit: string
  ahead: number
  behind: number
  lastUpdated: number
  hasUncommittedChanges?: boolean
  diff?: DiffSummary
  storyChanges?: StoryFeatureChange[]
  metrics?: GitMetrics
}

/** Event payload emitted by startGitMonitor. Small by default: patches are excluded. */
export type GitBranchEvent = GitBranchState & { schemaVersion: string; kind: 'git-branch-state' }

/** Resolver arguments passed to a StoryResolver. */
export type StoryResolverArgs = {
  repoPath: string
  baseRef: string
  headRef: string
  diff: DiffSummary
}

/** A function mapping a diff into story/feature change groups. */
export type StoryResolver = (args: StoryResolverArgs) => Promise<StoryFeatureChange[]>

/** Pluggable provider for attaching test or coverage metrics to a branch report. */
export type MetricsProvider = (
  args: StoryResolverArgs & { storyChanges?: StoryFeatureChange[] },
) => Promise<GitMetrics | undefined>

/** Alias to align with story wording */
export type GitMetricsProvider = MetricsProvider

/** Configuration for startGitMonitor. */
export type GitMonitorConfig = {
  repoPath: string
  baseBranch: string
  branchFilter?: RegExp | ((branch: string) => boolean)
  pollIntervalMs?: number
  includePatch?: boolean
  readOnly?: boolean
  debounceMs?: number
  storyResolver?: StoryResolver
  metricsProvider?: MetricsProvider
  onUpdate?: (state: GitBranchEvent) => void
  onError?: (err: unknown) => void
}

/** Handle returned by startGitMonitor with subscription utilities. */
export type GitMonitor = {
  stop: () => void
  subscribe: (cb: (state: GitBranchEvent) => void) => () => void
  getState: () => Array<GitMonitorState>
}
export type GitMonitorState = {
  name: string
  headSha: string
  ahead: number
  behind: number
  lastUpdatedAt: number
  hasUncommittedChanges: boolean
}

/** JSON-serializable per-branch report suitable for client-side rendering. */
export type BranchReport = {
  schemaVersion: string
  kind: 'branch-report'
  generatedAt: number
  repoPath: string
  baseRef: string
  headRef: string
  branch: {
    name: string
    headSha: string
    ahead: number
    behind: number
    hasUncommittedChanges?: boolean
  }
  totals: { insertions: number; deletions: number; filesChanged: number }
  files: Array<{
    path: string
    status: GitFileStatus
    additions?: number
    deletions?: number
    oldPath?: string
  }>
  groups: Array<StoryFeatureChange>
  patch?: string
  metrics?: GitMetrics
  metricsError?: string | null
}

/** Workspace-level report comprising multiple BranchReport entries. */
export type WorkspaceReport = {
  schemaVersion: string
  kind: 'workspace-report'
  generatedAt: number
  repoPath: string
  baseRef: string
  branches: BranchReport[]
}
