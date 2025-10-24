export type GitHubCredentials = {
  id: string
  name: string
  username: string
  email: string
  token: string
}

export type CredentialsService = {
  subscribe: (callback: () => void) => () => void
  list: () => Promise<GitHubCredentials[]>
  add: (input: Omit<GitHubCredentials, 'id'>) => Promise<GitHubCredentials>
  update: (id: string, patch: Partial<GitHubCredentials>) => Promise<GitHubCredentials | undefined>
  remove: (id: string) => Promise<void>
}

export const credentialsService: CredentialsService = { ...window.credentialsService }
