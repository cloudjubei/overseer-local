export type IngestionProgress = {
  status: 'idle' | 'running' | 'done' | 'error'
  message?: string
  total?: number
  processed?: number
  error?: string
}

// Renderer-side thin wrapper over preload-exposed API
export const dbService = {
  startIngestion: async (): Promise<void> => {
    // @ts-ignore
    if (window.db?.startIngestion) await window.db.startIngestion()
  },
  onIngestionStatus: (cb: (p: IngestionProgress) => void): (() => void) => {
    // @ts-ignore
    if (window.db?.onIngestionStatus) return window.db.onIngestionStatus(cb)
    return () => {}
  },
}
