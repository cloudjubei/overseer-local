import type { BrowserWindow } from 'electron'
import crypto from 'crypto'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { classifyDocumentType } from '../db/fileTyping'
import BaseManager from '../BaseManager'
import type DatabaseManager from '../db/DatabaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import type FilesManager from '../files/FilesManager'
import { FileMeta } from 'thefactory-tools'
import { Document } from 'thefactory-db'
import path from 'path'

function sha1(buf: Buffer): string {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function toRelUnix(p: string): string {
  return (p || '').replace(/\\/g, '/')
}

export default class DocumentIngestionManager extends BaseManager {
  private databaseManager: DatabaseManager
  private projectsManager: ProjectsManager
  private filesManager: FilesManager

  private handling: Record<string, boolean>

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    databaseManager: DatabaseManager,
    projectsManager: ProjectsManager,
    filesManager: FilesManager,
  ) {
    super(projectRoot, window)

    this.databaseManager = databaseManager
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
    await this._ensureHandling(projectId)

    if (!this.databaseManager.isConnected()) {
      console.info('[DocumentIngestion] stopped - dbManager not connected projectId:', projectId)
      return
    }

    const project = await this.projectsManager.getProject(projectId as any)
    if (!project) {
      console.warn('[DocumentIngestion] missing project', projectId)
      return
    }

    const files = ((await this.filesManager.getAllFileStats(projectId)) || []) as FileMeta[]

    let ingested = 0
    let failed = 0

    for (const f of files) {
      try {
        const relPath: string = f.relativePath!
        const content = await this.filesManager.readFile(projectId, relPath)
        const stats = await this.filesManager.getFileStats(projectId, relPath)
        if (content && stats) {
          await this.__handleFileAdded(projectId, relPath, content, stats)
        }
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

  private async handleFileAdded(projectId: string, relPath: string) {
    try {
      const content = await this.filesManager.readFile(projectId, relPath)
      const stats = await this.filesManager.getFileStats(projectId, relPath)
      if (content && stats) {
        await this.__handleFileAdded(projectId, relPath, content, stats)
      }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileAdded failed', projectId, relPath, e)
    }
  }

  private async handleFileChanged(projectId: string, relPath: string) {
    return this.handleFileAdded(projectId, relPath)
  }

  private async handleFileRenamed(projectId: string, relPathSource: string, relPathTarget: string) {
    try {
      const d = await this.databaseManager.getDocumentBySrc(toRelUnix(relPathSource))
      if (d) {
        await this.databaseManager.updateDocument(d.id, { src: toRelUnix(relPathTarget) })
      }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileRenamed failed', projectId, relPathSource, e)
    }
  }

  private async handleFileDeleted(projectId: string, relPath: string) {
    try {
      const d = await this.databaseManager.getDocumentBySrc(toRelUnix(relPath))
      if (d?.id) await this.databaseManager.deleteDocument(d.id)
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileDeleted failed', projectId, relPath, e)
    }
  }

  private __handleFileAdded = async (
    projectId: string,
    relPath: string,
    content: string,
    stats: FileMeta,
  ): Promise<Document | undefined> => {
    const contentHash = sha1(Buffer.from(content || '', 'utf8'))
    const type = classifyDocumentType(stats.ext, relPath)

    const name = path.basename(relPath)
    const srcKey = toRelUnix(relPath)

    const d = await this.databaseManager.getDocumentBySrc(srcKey)
    if (d) {
      if (d.metadata?.contentHash === contentHash && d.metadata?.mtime === stats.mtime) {
        return d
      }
      console.log(
        '__handleFileAdded old mtime: ',
        d.metadata?.mtime,
        ' stats.mtime: ',
        stats.mtime,
        ' d.hash: ',
        d.metadata?.contentHash,
        ' contentHash: ',
        contentHash,
      )
      return await this.databaseManager.updateDocument(d.id, {
        content,
        metadata: { ...(d.metadata || {}), contentHash, mtime: stats.mtime },
      })
    }

    const input = {
      projectId,
      type,
      content,
      src: srcKey,
      name,
      metadata: {
        ext: stats.ext,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        contentHash,
      },
    }
    return await this.databaseManager.addDocument(input)
  }

  private async _ensureHandling(projectId: string): Promise<void> {
    if (!this.handling[projectId]) {
      await this.filesManager.addChangeHandler(projectId, async (update) => {
        switch (update.type) {
          case 'addFile': {
            await this.handleFileAdded(projectId, update.relPath)
          }
          case 'change': {
            await this.handleFileChanged(projectId, update.relPath)
          }
          case 'deleteFile': {
            await this.handleFileDeleted(projectId, update.relPath)
          }
          // case 'addDirectory' : {
          // }
          // case 'deleteDirectory' : {
          // }
        }
      })
      this.handling[projectId] = true
    }
  }
}
