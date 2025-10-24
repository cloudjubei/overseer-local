import type { ProjectGitSummary } from '../contexts/GitContext'
import type {
  MergePlan,
  MergePlanOptions,
  BuildMergeReportOptions,
  MergeReport,
  ApplyMergeOptions,
  MergeResult,
  LocalStatusOptions,
  LocalStatus,
  DiffSummary,
} from '../../../logic/git/gitTypes.copy'

export type GitService = {
  // Aggregate pending branches: if projectId provided, returns only that project; otherwise aggregates all
  todo: (projectId?: string) => Promise<{ projects: ProjectGitSummary[] }>

  // Merge planning/reporting
  getMergePlan: (
    args: Omit<MergePlanOptions, 'repoPath'>,
  ) => Promise<MergePlan>
  buildMergeReport: (
    planOrOptions: MergePlan | Omit<MergePlanOptions, 'repoPath'>,
    options?: BuildMergeReportOptions,
  ) => Promise<MergeReport>
  applyMerge: (options: Omit<ApplyMergeOptions, 'repoPath'>) => Promise<MergeResult>

  // Local repo helpers
  getLocalStatus: (options?: Omit<LocalStatusOptions, 'repoPath'>) => Promise<LocalStatus>
  getBranchDiffSummary: (options: {
    baseRef: string
    headRef: string
    includePatch?: boolean
  }) => Promise<DiffSummary>
}

export const gitService: GitService = {
  ...window.gitService,
}
