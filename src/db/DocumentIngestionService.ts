import { EventEmitter } from 'events'
import path from 'path'
import fs from 'fs'

// A lightweight ingestion service that scans the repo and emits progress while simulating indexing.
// In a full implementation, this would integrate with thefactory-db and thefactory-tools to add/update documents.

export type IngestionProgress = {
  status: 'idle' | 'running' | 'done' | 'error'
  message?: string
  total?: number
  processed?: number
  error?: string
}

export class DocumentIngestionService extends EventEmitter {
  private running = false

  constructor() {
    super()
  }

  isRunning() {
    return this.running
  }

  // Sync all projects: for now we treat the current repo as a single project, scan files and emit progress.
  async syncAllProjects() {
    if (this.running) return
    this.running = true
    const progress: IngestionProgress = { status: 'running', message: 'Starting indexing…', total: 0, processed: 0 }
    this.emit('progress', progress)

    try {
      const files = await this.collectFiles(process.cwd())
      progress.total = files.length
      this.emit('progress', { ...progress, message: 'Indexing project files…' })

      let processed = 0
      for (const file of files) {
        // In real implementation: call addDocument with appropriate type and content.
        // Here we just simulate small delay to keep UI responsive.
        processed += 1
        if (processed % 25 === 0 || processed === files.length) {
          this.emit('progress', {
            status: 'running',
            message: `Indexing project files… (${processed}/${files.length})`,
            total: files.length,
            processed,
          })
        }
        // Tiny yield
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 1))
      }

      this.emit('progress', { status: 'done', message: 'Indexing complete', total: files.length, processed: files.length })
    } catch (e: any) {
      this.emit('progress', { status: 'error', error: e?.message || String(e) })
    } finally {
      this.running = false
    }
  }

  private async collectFiles(root: string): Promise<string[]> {
    const ignoreDirs = new Set([
      'node_modules', '.git', 'dist', 'build', 'out', '.next', '.cache', '.turbo', '.parcel-cache'
    ])
    const results: string[] = []

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        const rel = path.relative(root, full)
        if (entry.isDirectory()) {
          if (ignoreDirs.has(entry.name)) continue
          walk(full)
        } else if (entry.isFile()) {
          // We can decide to skip certain binary files by extension in a real implementation
          results.push(rel)
        }
      }
    }

    walk(root)
    return results
  }
}

export const documentIngestionService = new DocumentIngestionService()
