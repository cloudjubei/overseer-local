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

    if (!this.dbManager.isConnected()) {
      console.info('[DocumentIngestion] stopped - dbManager not connected projectId:', projectId)
      return
    }

    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      console.warn('[DocumentIngestion] missing project', projectId)
      return
    }

    const files = (await this.filesManager.listFiles(projectId)) || []

    let ingested = 0
    let failed = 0

    for (const f of files) {
      try {
        const { path: relPath, absolutePath: src, ...stats } = f
        const content = await this.filesManager.readFile(projectId, relPath)
        await this.__handleFileAdded({ projectId, src, relPath, content, stats })
        ingested++
      } catch (e) {
        failed++
        console.warn('[DocumentIngestion] file ingest failed: ', e)
      }
    }
    console.info(
      '[DocumentIngestion] Finished ingestProject:',
      projectId,
      ' ingested: ',
      ingested,
      ' failed: ',
      failed,
    )
  }

  handleFileAdded = async ({ projectId, relPath, content }) => {
    try {
      const src = await this.filesManager.getAbsoluteFilePath(projectId, relPath)
      const stats = await this.filesManager.getFileStats(projectId, relPath)

      await this.__handleFileAdded({ projectId, src, relPath, content, stats })
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileAdded failed', projectId, relPath, e)
    }
  }

  handleFileChanged = async ({ projectId, relPath, content }) => {
    this.handleFileAdded({ projectId, relPath, content })
  }

  handleFileRenamed = async ({ projectId, relPathSource, relPathTarget }) => {
    try {
      const d = await this.dbManager.getDocumentBySrc(relPathSource)
      if (d) {
        await this.dbManager.updateDocument(d.id, { src: relPathTarget })
      }
    } catch {}
  }

  handleFileDeleted = async ({ projectId, relPath }) => {
    try {
      const d = await this.dbManager.getDocumentBySrc(relPathSource)
      await this.dbManager.deleteDocument(id)
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileDeleted failed', projectId, relPath, e)
    }
  }

  __handleFileAdded = async ({ projectId, src, relPath, content, stats }) => {
    const contentHash = sha1(Buffer.from(content, 'utf8'))
    const type = classifyDocumentType(stats.ext, relPath)

    const d = await this.dbManager.getDocumentBySrc(src)
    if (d) {
      if (d.metadata?.contentHash === contentHash && d.metadata?.mtime === stats.mtime) {
        return d
      }
      return await this.dbManager.updateDocument(d.id, { content })
    }

    const input = {
      projectId,
      type,
      content,
      src,
      metadata: {
        ext: stats.ext,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        contentHash,
      },
    }
    return await this.dbManager.addDocument(input)
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
