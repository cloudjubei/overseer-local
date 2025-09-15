import { ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { classifyDocumentType } from '../db/fileTyping'

function sha1(buf) {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function toRelUnix(p) {
  return (p || '').replace(/\\/g, '/')
}

export class DocumentIngestionManager {
  constructor(projectRoot, window, dbManager, projectsManager, filesManager) {
    this.projectRoot = projectRoot
    this.window = window

    this.dbManager = dbManager // expected to expose getClient() -> thefactory-db client
    this.projectsManager = projectsManager
    this.filesManager = filesManager

    this.handling = {}
    this._ipcBound = false
  }

  async init() {
    this._registerIpcHandlers()
  }

  stopWatching() {
    // no-op; ingestion uses FilesManager watchers
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}
    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_ALL] = async () => await this.ingestAll()
    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_PROJECT] = async ({ projectId }) =>
      await this.ingestProject(projectId)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  async getDb() {
    const db = await this.dbManager?.getClient?.()
    if (!db) throw new Error('DB client unavailable')
    return db
  }

  async ingestAll() {
    const projects = await this.projectsManager.listProjects()
    const results = {}
    for (const p of projects) {
      results[p.id] = await this.ingestProject(p.id)
    }
    return { ok: true, results }
  }

  async ingestProject(projectId) {
    console.info('[DocumentIngestion] ingestProject:', projectId)
    await this._ensureHandling(projectId)

    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      console.warn('[DocumentIngestion] missing project', projectId)
      return { ok: false, error: 'Project not found' }
    }

    const files = (await this.filesManager.listFiles(projectId)) || []

    let added = 0, updated = 0, unchanged = 0, failed = 0

    const db = await this.getDb()

    for (const f of files) {
      try {
        const { path: relPath, size, mtime, ext } = f
        const content = await this.filesManager.readFile(projectId, relPath, 'utf8')
        const contentHash = sha1(Buffer.from(content, 'utf8'))
        const type = classifyDocumentType(ext, relPath)

        const docId = this._documentIdFor(projectId, relPath)

        const meta = {
          projectId,
          relPath,
          ext,
          size,
          mtime,
          contentHash,
          type,
        }

        const existing = await db.getDocumentById?.(docId)
        if (existing && existing.metadata?.contentHash === contentHash && existing.metadata?.mtime === mtime) {
          unchanged++
          continue
        }

        // addDocument acts as upsert based on unique keys in DB implementation.
        const input = {
          id: docId,
          projectId,
          source: 'project',
          sourceRef: relPath,
          title: relPath,
          type,
          content,
          metadata: meta,
        }

        const res = await db.addDocument(input)
        if (res?.updated) updated++
        else if (res?.created) added++
        else if (existing) updated++
        else added++
      } catch (e) {
        failed++
        console.warn('[DocumentIngestion] file ingest failed', f?.path, e?.message || e)
      }
    }

    return { ok: true, stats: { added, updated, unchanged, failed, total: files.length } }
  }

  _documentIdFor(projectId, relPath) {
    // Stable unique id per project+path
    return `proj:${projectId}:${toRelUnix(relPath)}`
  }

  handleFileAdded = async ({ projectId, relPath }) => {
    try {
      const db = await this.getDb()
      const s = await this.filesManager.listFiles(projectId)
      const f = s?.find((x) => x.path === relPath)
      if (!f) return { ok: false, error: 'File not found in storage index' }
      const content = await this.filesManager.readFile(projectId, relPath, 'utf8')
      const contentHash = sha1(Buffer.from(content, 'utf8'))
      const type = classifyDocumentType(f.ext, relPath)
      const id = this._documentIdFor(projectId, relPath)
      const existing = await db.getDocumentById?.(id)
      if (existing && existing.metadata?.contentHash === contentHash && existing.metadata?.mtime === f.mtime) {
        return { ok: true, result: { unchanged: true } }
      }
      const input = {
        id,
        projectId,
        source: 'project',
        sourceRef: relPath,
        title: relPath,
        type,
        content,
        metadata: {
          projectId,
          relPath,
          ext: f.ext,
          size: f.size,
          mtime: f.mtime,
          contentHash,
          type,
        },
      }
      const res = await db.addDocument(input)
      return { ok: true, result: res }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileAdded failed', projectId, relPath, e)
      return { ok: false, error: String(e?.message || e) }
    }
  }

  handleFileChanged = async ({ projectId, relPath }) => {
    // Treat same as added: upsert based on id/hash
    return await this.handleFileAdded({ projectId, relPath })
  }

  handleFileRenamed = async ({ projectId, relPathSource, relPathTarget }) => {
    // Mark old archived, add new
    try {
      const db = await this.getDb()
      const oldId = this._documentIdFor(projectId, relPathSource)
      if (db.archiveDocument) {
        try { await db.archiveDocument({ id: oldId, reason: 'renamed', newPath: relPathTarget }) } catch {}
      } else if (db.deleteDocument) {
        try { await db.deleteDocument({ id: oldId }) } catch {}
      }
    } catch {}
    return await this.handleFileAdded({ projectId, relPath: relPathTarget })
  }

  handleFileDeleted = async ({ projectId, relPath }) => {
    try {
      const db = await this.getDb()
      const id = this._documentIdFor(projectId, relPath)
      if (db.archiveDocument) {
        await db.archiveDocument({ id, reason: 'deleted' })
      } else if (db.deleteDocument) {
        await db.deleteDocument({ id })
      }
      return { ok: true }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileDeleted failed', projectId, relPath, e)
      return { ok: false, error: String(e?.message || e) }
    }
  }

  async _ensureHandling(projectId) {
    if (!this.handling[projectId]) {
      await this.filesManager.addChangeHandler(projectId, {
        onAdd: this.handleFileAdded,
        onChange: this.handleFileChanged,
        onUnlink: this.handleFileDeleted,
        onRename: this.handleFileRenamed,
      })
      this.handling[projectId] = true
    }
  }
}
