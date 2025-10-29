export type GitOpResult =
  | { ok: true; result: GitExecResult }
  | { ok: false; error: string; result?: GitExecResult }

export type GitExecResult = { code: number; stdout: string; stderr: string }

export type GitStatusPorcelain = {
  staged: string[]
  unstaged: string[]
  untracked: string[]
}

/** Detailed information about a Git branch. */
export type GitBranchDetails = {
  name: string
  commitSha: string
  /** ISO 8601 formatted commit date string. */
  commitDate: string
  current?: boolean
}

/** Scope for listing branches. */
export type ListBranchesScope = 'local' | 'remote' | 'all'

/**
 * Unified representation of a branch across local and remote.
 *
 * A single entry conveys whether the branch exists locally and/or remotely,
 * its tracking relationship, and simple divergence stats relative to upstream
 * when applicable. Shapes are JSON-serializable and stable for remote usage.
 */
export type GitUnifiedBranch = {
  /** Short branch name without refs/ prefix, e.g. 'feature/x'. */
  name: string
  /** Full refname for the local branch when present, e.g. 'refs/heads/feature/x'. */
  fullName?: string
  /** Whether a local branch exists. */
  isLocal: boolean
  /** Whether a remote branch exists. */
  isRemote: boolean
  /** Remote tracking ref short name, e.g. 'origin/feature/x', when known. */
  remoteName?: string
  /** The configured upstream remote (e.g., 'origin') when tracking is set. */
  upstreamRemote?: string
  /** The configured upstream branch short name when tracking is set. */
  upstreamBranch?: string
  /** Local commit SHA if local exists. */
  localSha?: string
  /** Remote commit SHA if remote exists (tracking or matching name on default remote). */
  remoteSha?: string
  /** Divergence relative to upstream (ahead/behind counts). Only set when upstream is configured. */
  ahead?: number
  behind?: number
  /** Heuristic metadata extracted from branch naming, e.g., UUID-like story id suffix. */
  storyId?: string
  /** True when this local branch is the current checked-out branch. */
  current?: boolean
}

// =====================
// Feature/Story metadata (FeatureInfo Contract)
// =====================

/** Canonical reference to a story and optionally a specific feature within it. */
export type FeatureRef = {
  /** Canonical story id (UUID or similar). */
  storyId: string
  /** Canonical feature id if commit is tied to a specific feature. */
  featureId?: string
}

/** Optional enriched metadata about a story/feature for display. */
export type FeatureInfo = FeatureRef & {
  /** Feature or story title for display (prefer feature when featureId is set). */
  title?: string
  /** Short description. */
  description?: string
}

/** Context information available to FeatureInfo resolvers. */
export interface FeatureInfoResolverContext {
  /** Raw commit message (subject + body when available). */
  message?: string
  /** Branch context where observed. */
  branch?: string
  /** Repository root (read-only expectation). */
  repoRoot?: string
}

/** Function to resolve FeatureInfo for a commit. First non-null wins. */
export type FeatureInfoResolver = (
  commit: CommitInfo,
  ctx: FeatureInfoResolverContext,
) => FeatureInfo | undefined | null | Promise<FeatureInfo | undefined | null>

/** Options controlling FeatureInfo extraction. */
export interface FeatureInfoOptions {
  /** Enable conservative fallback heuristics when custom resolvers do not resolve. Default: true. */
  enableHeuristics?: boolean
  /** Custom resolvers; first non-null wins. */
  resolvers?: FeatureInfoResolver[]
}

export type GitTools = {
  /** Initialize the Git tools for the repository (e.g., configure remotes/credentials).
   * @example
   * const git = createGitTools('/abs/project/root', 'https://github.com/owner/repo.git', creds)
   * await git.init()
   */
  init(): Promise<void>

  /** Get repository status parsed into staged/unstaged/untracked sets.
   * @example
   * const r = await git.status()
   * console.log(r.status?.staged)
   */
  status(): Promise<GitOpResult & { status?: GitStatusPorcelain }>

  /** List configured remotes.
   * @example
   * const r = await git.listRemotes()
   * console.log(r.remotes)
   */
  listRemotes(): Promise<GitOpResult & { remotes?: string[] }>

  /**
   * Fetch updates from a remote.
   * @param remote Remote name (default 'origin').
   * @example
   * await git.fetch('origin')
   */
  fetch(remote?: string): Promise<GitOpResult>

  /**
   * Pull from a remote/branch.
   * @param remote Remote name (default 'origin').
   * @param branch Branch name (default current branch).
   * @example
   * await git.pull('origin', 'main')
   */
  pull(remote?: string, branch?: string): Promise<GitOpResult>

  /**
   * Push to a remote/branch.
   * @param remote Remote name (default 'origin').
   * @param branch Branch name (default current branch).
   * @example
   * await git.push('origin', 'feature/x')
   */
  push(remote?: string, branch?: string): Promise<GitOpResult>

  /**
   * Stage changes by path.
   * @param path Project-relative path to stage.
   * @example
   * await git.stage('src/index.ts')
   */
  stage(path: string): Promise<GitOpResult>

  /** Stage all changes in the working tree.
   * @example
   * await git.stageAll()
   */
  stageAll(): Promise<GitOpResult>

  /**
   * Unstage changes by path.
   * @param path Project-relative path to unstage.
   * @example
   * await git.reset('src/index.ts')
   */
  reset(path: string): Promise<GitOpResult>

  /**
   * Discard local changes by checking out the given path.
   * @param path Project-relative path to discard changes for.
   * @example
   * await git.discard('src/components')
   */
  discard(path: string): Promise<GitOpResult>

  /**
   * Stage all, commit with a message, and push to upstream.
   * @param message Commit message.
   * @example
   * await git.pushAll('feat: add new component')
   */
  pushAll(message: string): Promise<void>

  /**
   * Create a new branch.
   * @param name Branch name.
   * @param checkoutAfter Whether to check out the new branch after creation.
   * @example
   * await git.createBranch('feature/new-api', true)
   */
  createBranch(name: string, checkoutAfter?: boolean): Promise<GitOpResult>

  /**
   * Checkout an existing branch or create it when requested.
   * @param name Branch name.
   * @param create Whether to create the branch before checking out.
   * @example
   * await git.checkoutBranch('feature/new-api', false)
   */
  checkoutBranch(name: string, create: boolean): Promise<GitOpResult>

  /**
   * Safely delete a local branch.
   * @param name Branch name to delete.
   * @example
   * await git.deleteBranch('old/unused')
   */
  deleteBranch(name: string): Promise<GitOpResult>

  /**
   * Safely delete a remote branch.
   * @param name Branch name to delete on the remote.
   * @param remote The remote to delete from (default 'origin').
   * @example
   * await git.deleteRemoteBranch('feature/old-stuff', 'origin')
   */
  deleteRemoteBranch(name: string, remote?: string): Promise<GitOpResult>

  /**
   * Rename a local branch.
   * @param oldName Current branch name.
   * @param newName New branch name.
   * @example
   * await git.renameBranch('feature/tmp', 'feature/final')
   */
  renameBranch(oldName: string, newName: string): Promise<GitOpResult>

  /**
   * Set upstream tracking for the current or specified branch.
   * @param remote Remote name (default 'origin').
   * @param branch Branch name (default current branch).
   * @example
   * await git.setUpstream('origin', 'main')
   */
  setUpstream(remote?: string, branch?: string): Promise<GitOpResult>

  /**
   * List branches with details like commit SHA and date.
   * @param scope The scope of branches to list (default 'local').
   * @example
   * const r = await git.listBranches('all')
   * console.log(r.branches)
   */
  listBranches(scope?: ListBranchesScope): Promise<GitOpResult & { branches?: GitBranchDetails[] }>

  /**
   * List unified branches combining local and remote presence, tracking and divergence.
   * @example
   * const r = await git.listUnifiedBranches()
   * console.log(r.branches)
   */
  listUnifiedBranches(): Promise<GitOpResult & { branches?: GitUnifiedBranch[] }>

  /** Get the current branch name.
   * @example
   * const r = await git.getCurrentBranch()
   * console.log(r.branch)
   */
  getCurrentBranch(): Promise<string | undefined>

  /**
   * Read and return the full content of a file at a given git ref using 'git show <ref>:<filePath>'.
   * @param repoPath Project-relative path to the repository root injected by the factory.
   * @param filePath Project-relative path to the file inside the repository.
   * @param ref Any git reference (branch, tag, or commit SHA).
   * @example
   * const content = await git.getFileContent('src/index.ts', 'main')
   */
  getFileContent(filePath: string, ref: string): Promise<string>

  // From GitMonitorTools
  /**
   * Start monitoring feature branches with periodic updates.
   * @param config Monitor configuration (repoPath is injected by the factory).
   * @example
   * const handle = git.startMonitor({ baseBranch: 'main', pollIntervalMs: 5000 })
   * const unsubscribe = handle.subscribe((s) => console.log('branch state', s.name))
   */
  startMonitor: (config: Omit<GitMonitorConfig, 'repoPath'>) => GitMonitor

  /**
   * Compute a file-level diff summary between a base and head ref (equivalent to 'git diff base...head').
   * When incomingOnly=true it avoids showing base-only changes as deletions, i.e. showing incoming changes only.
   * @param args Options including baseRef, headRef, incomingOnly and includePatch.
   * @example
   * const diff = await git.getBranchDiffSummary({ baseRef: 'main', headRef: 'feature/x', includePatch: true })
   */
  getBranchDiffSummary: (args: {
    baseRef: string
    headRef: string
    incomingOnly?: boolean
    includePatch?: boolean
  }) => Promise<DiffSummary>

  /**
   * Resolve changes in a diff to stories/features using a resolver.
   * @param args Options including baseRef, headRef, resolvers and optional diff.
   * @example
   * const res = await git.resolveChangesToStories({ baseRef: 'main', headRef: 'feature/x' })
   */
  resolveChangesToStories: (args: {
    baseRef: string
    headRef: string
    resolvers?: StoryResolver | StoryResolver[]
    diff?: DiffSummary
  }) => Promise<{ groups: StoryFeatureChange[] }>

  /**
   * Build a detailed branch report suitable for clients.
   * @param args Report options (repoPath is injected by the factory).
   * @example
   * const report = await git.buildBranchReport({ repoPath: '.', baseRef: 'main', headRef: 'feature/x' })
   */
  buildBranchReport: (args: {
    repoPath: string
    baseRef: string
    headRef: string
    includePatch?: boolean
    includeMetrics?: boolean
    storyResolver?: StoryResolver
    metricsProvider?: MetricsProvider
    featureInfo?: FeatureInfoOptions
  }) => Promise<BranchReport>

  /**
   * Build a workspace report across multiple branches.
   * @param args Workspace report options (repoPath is injected by the factory).
   * @example
   * const ws = await git.buildWorkspaceReport({ repoPath: '.', baseRef: 'main', branches: ['feat/a', 'feat/b'] })
   */
  buildWorkspaceReport: (args: {
    repoPath: string
    baseRef: string
    branches: string[]
    includePatch?: boolean
    includeMetrics?: boolean
    storyResolver?: StoryResolver
    metricsProvider?: MetricsProvider
    featureInfo?: FeatureInfoOptions
  }) => Promise<WorkspaceReport>

  // Review ops from GitMonitorTools
  /**
   * Mark files as accepted for commit selection.
   * @param files List of project-relative file paths.
   * @example
   * await git.acceptFiles(['src/index.ts'])
   */
  acceptFiles: (files: string[]) => Promise<void>

  /**
   * Mark files as rejected by comparing against a base ref.
   * @param baseRef Base ref for comparison.
   * @param files List of project-relative file paths.
   * @example
   * await git.rejectFiles('main', ['src/index.ts'])
   */
  rejectFiles: (baseRef: string, files: string[]) => Promise<void>

  /**
   * Reset selected files back to their previous state.
   * @param files Optional list of project-relative file paths (all when omitted).
   * @example
   * await git.resetFiles(['src/index.ts'])
   */
  resetFiles: (files?: string[]) => Promise<void>

  /**
   * Commit a selection of changes with message and options.
   * @param args Commit options including message, signoff and trailers.
   * @example
   * await git.commitSelection({ repoPath: '.', message: 'chore: apply selection' })
   */
  commitSelection: (args: {
    repoPath: string
    message: string
    signoff?: boolean
    trailers?: Record<string, string> | string[]
  }) => Promise<void>

  // From GitMergeTools
  /**
   * Compute a merge plan with optional patches.
   * @param options Merge plan options (repoPath is injected by the factory).
   * @example
   * const plan = await git.getMergePlan({ sources: ['feature/x'], baseRef: 'main', includePatch: true })
   */
  getMergePlan: (options: Omit<MergePlanOptions, 'repoPath'>) => Promise<MergePlan>

  /**
   * Apply a merge with safety checks.
   * @param options Merge application options (repoPath is injected by the factory).
   * @example
   * const result = await git.applyMerge({ sources: ['feature/x'], baseRef: 'main' })
   */
  applyMerge: (options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>

  /**
   * Build a JSON-serializable merge report from a plan.
   * @param plan Merge plan to report.
   * @param options Report options controlling patch inclusion and requested analyses.
   * @example
   * const report = git.buildMergeReport(plan, { includePatch: true, analyses: ['tests'] })
   */
  buildMergeReport: (plan: MergePlan, options?: MergeReportOptions) => MergeReport

  /**
   * Read the local repository status.
   * @param options Status options (repoPath is injected by the factory).
   * @example
   * const status = await git.getLocalStatus()
   */
  getLocalStatus: (options?: Omit<LocalStatusOptions, 'repoPath'>) => Promise<LocalStatus>

  /**
   * Select commits unique to sources vs a base.
   * @param options Selection options (repoPath is injected by the factory).
   * @example
   * const commits = await git.selectCommits({ sources: ['feature/x'], baseRef: 'main' })
   */
  selectCommits: (options: Omit<SelectCommitsOptions, 'repoPath'>) => Promise<CommitInfo[]>

  /**
   * Plan a cherry-pick operation.
   * @param options Cherry-pick plan options (repoPath is injected by the factory).
   * @example
   * const plan = await git.planCherryPick({ commits: ['abcd1234'] })
   */
  planCherryPick: (options: Omit<PlanCherryPickOptions, 'repoPath'>) => Promise<MergePlan>

  /**
   * Apply a cherry-pick against the working tree.
   * @param options Cherry-pick application options (repoPath is injected by the factory).
   * @example
   * const res = await git.applyCherryPick({ commits: ['abcd1234'] })
   */
  applyCherryPick: (options: Omit<ApplyCherryPickOptions, 'repoPath'>) => Promise<MergeResult>

  /**
   * Explicitly fetch remote refs.
   * @param options Fetch options (repoPath is injected by the factory).
   * @example
   * const refs = await git.fetchRefs({ remote: 'origin' })
   */
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

/** A single line within a diff hunk with explicit classification. */
export type DiffLineType = 'add' | 'del' | 'context'
export type DiffLine = {
  /** Kind of change represented by this line. */
  type: DiffLineType
  /** Line text without the leading diff marker (+, -, or space). */
  text: string
  /** Old-file line number for this line, when applicable. */
  oldLine?: number
  /** New-file line number for this line, when applicable. */
  newLine?: number
}

/** Parsed representation of a unified diff hunk. */
export type DiffHunk = {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  /** Optional trailing header/comment included in the @@ header line. */
  header?: string
  /** Lines comprising this hunk with explicit add/del/context markers. */
  lines: DiffLine[]
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
  /** Include raw unified diff patch text in MergeReportFile.patch. */
  includePatch?: boolean
  /** Maximum number of files to include patch bodies for. */
  maxPatchedFiles?: number
  /** Maximum total bytes of patch text across all files. */
  maxPatchBytes?: number
  /** When true, also include a parsed, structured representation of each file's patch as structuredDiff. */
  includeStructuredDiff?: boolean
}

/** MergeReportOptions extends existing report controls with optional analyses. */
export interface MergeReportOptions extends BuildMergeReportOptions {
  /** Optional analyses to include in the merge report. */
  analyses?: Array<'compilation' | 'tests' | 'coverage'>
}

/** Analysis: heuristic compilation impact summary. */
export interface CompilationImpactAnalysis {
  summary: string
  details: Array<{ path: string; risk: 'low' | 'medium' | 'high'; reason: string }>
}

/** Analysis: impacted tests listing and total catalog size if known. */
export interface TestsImpactAnalysis {
  impacted: string[]
  totalCatalog: number
}

/** Analysis: diff coverage numbers overall and per-file. */
export interface DiffCoverageAnalysis {
  totalAdded: number
  covered: number
  pct: number
  perFile: Array<{ path: string; added: number; covered: number; pct: number }>
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
  /** Optional parsed hunk/line representation of the patch for easier client rendering. */
  structuredDiff?: DiffHunk[]
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
  /** Optional analyses included when requested in MergeReportOptions. */
  analysis?: {
    compilation?: CompilationImpactAnalysis
    tests?: TestsImpactAnalysis
    coverage?: DiffCoverageAnalysis
  }
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
  /** Optional enriched mapping to story/feature. */
  featureInfo?: FeatureInfo
}

/** Options for selecting commits unique to sources vs a base (e.g., for cherry-pick planning UIs). */
export type SelectCommitsOptions = {
  repoPath: string
  sources: string[]
  baseRef?: string
  includeMerges?: boolean
  maxCount?: number
  /** FeatureInfo enrichment options; when provided, featureInfo may be attached per commit. */
  featureInfo?: FeatureInfoOptions
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
  /** Optional raw patch text when requested. */
  patch?: string
  /** Optional per-commit list; entries may include featureInfo when enabled via options. */
  commits?: CommitInfo[]
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
