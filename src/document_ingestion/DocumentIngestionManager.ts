import type { BrowserWindow } from 'electron'
import crypto from 'crypto'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { classifyDocumentType } from '../db/fileTyping'
import BaseManager from '../BaseManager'
import type DatabaseManager from '../db/DatabaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import type FilesManager from '../files/FilesManager'

function sha1(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function toRelUnix(p: string): string {
  return (p || '').replace(/\\/g, '/')
}

export default class DocumentIngestionManager extends BaseManager {
  private dbManager: DatabaseManager
  private projectsManager: ProjectsManager
  private filesManager: FilesManager

  private handling: Record<string, boolean>

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    dbManager: DatabaseManager,
    projectsManager: ProjectsManager,
    filesManager: FilesManager,
  ) {
    super(projectRoot, window)

    this.dbManager = dbManager
    this.projectsManager = projectsManager
    this.filesManager = filesManager

    this.handling = {}
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_ALL] = async () => await this.ingestAll()
    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_PROJECT] = async ({ projectId }) =>
      await this.ingestProject(projectId)

    return handlers
  }

  async ingestAll(): Promise<void> {
    const projects = await this.projectsManager.listProjects()
    for (const p of projects) {
      await this.ingestProject(p.id)
    }
  }

  async ingestProject(projectId: string): Promise<void> {
    console.info('[DocumentIngestion] ingestProject:', projectId)
    await this._ensureHandling(projectId)

    if (!this.dbManager.isConnected()) {
      console.info('[DocumentIngestion] stopped - dbManager not connected projectId:', projectId)
      return
    }

    const project = await this.projectsManager.getProject(projectId as any)
    if (!project) {
      console.warn('[DocumentIngestion] missing project', projectId)
      return
    }

    const files = ((await this.filesManager.listFiles(projectId)) || []) as any[]

    let ingested = 0
    let failed = 0

    for (const f of files) {
      try {
        const relPath: string = f.path
        const content = (await this.filesManager.readFile(projectId, relPath)) as string
        const stats = await this.filesManager.getFileStats(projectId, relPath)
        await this.__handleFileAdded({ projectId, relPath, content, stats })
        ingested++
      } catch (e) {
        failed++
        console.warn('[DocumentIngestion] file ingest failed for: ', f, ' error: ', e)
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

  handleFileAdded = async ({
    projectId,
    relPath,
    content,
  }: {
    projectId: string
    relPath: string
    content: string
  }) => {
    try {
      const stats = await this.filesManager.getFileStats(projectId, relPath)
      await this.__handleFileAdded({ projectId, relPath, content, stats })
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileAdded failed', projectId, relPath, e)
    }
  }

  handleFileChanged = async ({
    projectId,
    relPath,
    content,
  }: {
    projectId: string
    relPath: string
    content: string
  }) => {
    this.handleFileAdded({ projectId, relPath, content })
  }

  handleFileRenamed = async ({
    projectId,
    relPathSource,
    relPathTarget,
  }: {
    projectId: string
    relPathSource: string
    relPathTarget: string
  }) => {
    try {
      const d = await this.dbManager.getDocumentBySrc(toRelUnix(relPathSource))
      if (d) {
        await this.dbManager.updateDocument(d.id, { src: toRelUnix(relPathTarget) })
      }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileRenamed failed', projectId, relPathSource, e)
    }
  }

  handleFileDeleted = async ({ projectId, relPath }: { projectId: string; relPath: string }) => {
    try {
      const d = await this.dbManager.getDocumentBySrc(toRelUnix(relPath))
      if (d?.id) await this.dbManager.deleteDocument(d.id)
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileDeleted failed', projectId, relPath, e)
    }
  }

  private __handleFileAdded = async ({
    projectId,
    relPath,
    content,
    stats,
  }: {
    projectId: string
    relPath: string
    content: string
    stats: any
  }): Promise<any> => {
    const contentHash = sha1(Buffer.from(content || '', 'utf8'))
    const type = classifyDocumentType(stats.ext, relPath)

    const srcKey = toRelUnix(relPath)

    const d = await this.dbManager.getDocumentBySrc(srcKey)
    if (d) {
      if (d.metadata?.contentHash === contentHash && d.metadata?.mtime === stats.mtime) {
        return d
      }
      return await this.dbManager.updateDocument(d.id, {
        content,
        metadata: { ...(d.metadata || {}), contentHash, mtime: stats.mtime },
      })
    }

    const input = {
      projectId,
      type,
      content,
      src: srcKey,
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

  private async _ensureHandling(projectId: string): Promise<void> {
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
