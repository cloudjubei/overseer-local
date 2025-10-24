import type { ProjectGitSummary } from '../contexts/GitContext'

export type GitService = {
  // If projectId is provided, returns only that project; otherwise aggregates all
  todo: (projectId?: string) => Promise<{ projects: ProjectGitSummary[] }>
}

export const gitService: GitService = {
  ...window.gitService,
}
