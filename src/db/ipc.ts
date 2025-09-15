import { ipcMain, WebContents } from 'electron'
import { documentIngestionService } from './DocumentIngestionService'

// Channels
export const DB_INGESTION_START = 'db:ingestion:start'
export const DB_INGESTION_STATUS = 'db:ingestion:status'

// Initialize IPC listeners for document ingestion progress streaming to renderer
export function setupDbIpc() {
  // Allow renderer to start ingestion (idempotent)
  ipcMain.handle(DB_INGESTION_START, async () => {
    if (!documentIngestionService.isRunning()) {
      // Fire but do not await - progress delivered via events
      documentIngestionService.syncAllProjects()
    }
    return { ok: true }
  })

  // When new renderer subscribes to status, we don't need a specific handler here; we will broadcast progress to all windows.
}

// Wire progress broadcasting to all webContents
export function bindDbIngestionBroadcast(getAllWebContents: () => WebContents[]) {
  documentIngestionService.on('progress', (p) => {
    const contents = getAllWebContents()
    for (const wc of contents) {
      try { wc.send(DB_INGESTION_STATUS, p) } catch {}
    }
  })
}
