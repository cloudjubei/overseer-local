import {
  DocumentInput,
  DocumentWithScore,
  Entity,
  EntityInput,
  EntityWithScore,
  SearchParams,
} from 'thefactory-db/dist/types'

export type ProjectSyncStatus = {
  lastSyncAt: string | null
}

export type DocumentIngestionService = {
  ingestAllProjects: () => Promise<any>
  ingestProject: (projectId: string) => Promise<any>
}

export const documentIngestionService: DocumentIngestionService = {
  ...window.documentIngestionService,
}
