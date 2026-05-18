export type DocumentIngestionService = {
  ingestAllProjects: () => Promise<void>
  ingestProject: (projectId: string) => Promise<void>
}

export const documentIngestionService: DocumentIngestionService = {
  ...window.documentIngestionService,
}
