import {
  DocumentInput,
  DocumentWithScore,
  Entity,
  EntityInput,
  EntityWithScore,
  SearchParams,
} from 'thefactory-db/dist/types'

export type DbStatus = {
  connected: boolean
  lastError: string | null
}

export type DBService = {
  subscribe: (callback: (status: DbStatus) => void) => () => void

  connect: (connectionString: string) => Promise<DbStatus>
  getStatus: () => Promise<DbStatus>

  //exposing all 'thefactory-db' methods
  addEntity(e: EntityInput): Promise<Entity>
  getEntityById(id: string): Promise<Entity | undefined>
  updateEntity(id: string, patch: Partial<EntityInput>): Promise<Entity | undefined>
  deleteEntity(id: string): Promise<boolean>
  searchEntities(params: SearchParams): Promise<EntityWithScore[]>
  matchEntities(
    criteria: any,
    options?: { types?: string[]; ids?: string[]; limit?: number },
  ): Promise<Entity[]>
  clearEntities(): Promise<void>
  addDocument(d: DocumentInput): Promise<Document>
  getDocumentById(id: string): Promise<Document | undefined>
  updateDocument(id: string, patch: Partial<DocumentInput>): Promise<Document | undefined>
  deleteDocument(id: string): Promise<boolean>
  searchDocuments(params: SearchParams): Promise<DocumentWithScore[]>
  clearDocuments(): Promise<void>
}

export const dbService: DBService = { ...window.dbService }
