export type ProjectSyncStatus = {
  lastSyncAt: string | null
}

export type DbStatus = {
  connected: boolean
  connectionString: string
  lastError: string | null
  lastSyncAt: string | null
  projects: Record<string, ProjectSyncStatus>
}

export type DbService = {
  getStatus: () => Promise<DbStatus>
  onStatus: (callback: (status: DbStatus) => void) => () => void
}

export const dbService: DbService = { ...(window as any).dbService }
