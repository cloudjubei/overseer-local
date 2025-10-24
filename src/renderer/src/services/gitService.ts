export type GitService = {
  todo: () => Promise<void>
}

export const gitService: GitService = {
  ...window.gitService,
}
