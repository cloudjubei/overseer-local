export type GitHubCredentials = {
  id: string
  name: string
  username: string
  email: string
  token: string
}

export type GitCredentialsService = {
  subscribe: (callback: () => void) => () => void
  list: () => Promise<GitHubCredentials[]>
  add: (input: Omit<GitHubCredentials, 'id'>) => Promise<GitHubCredentials>
  update: (id: string, patch: Partial<GitHubCredentials>) => Promise<GitHubCredentials | undefined>
  remove: (id: string) => Promise<void>
  get: (id: string) => Promise<GitHubCredentials | undefined>
}

export const gitCredentialsService: GitCredentialsService = { ...window.gitCredentialsService }
