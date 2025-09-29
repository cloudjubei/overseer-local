import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import type DatabaseManager from '../db/DatabaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import type FilesManager from '../files/FilesManager'
import { FileMeta } from 'thefactory-tools'
import { classifyDocumentType, isLikelyText } from 'thefactory-tools/utils'
import { Document, DocumentInput } from 'thefactory-db'
import path from 'path'
import BaseManager from '../BaseManager'

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
    await Promise.all(projects.map((p) => this.ingestProject(p.id)))
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

    const documentsToUpsert: DocumentInput[] = []
    for (const f of files) {
      try {
        const relPath: string = f.relativePath!
        const stats = await this.filesManager.getFileStats(projectId, relPath)
        if (!stats || !isLikelyText(stats.absolutePath, stats.ext, stats.type)) continue

        const content = await this.filesManager.readFile(projectId, relPath)
        if (content) {
          documentsToUpsert.push(this.createDocumentInput(projectId, relPath, content, stats))
        }
      } catch (e) {
        console.warn('[DocumentIngestion] file ingest failed for: ', f, ' error: ', e)
      }
    }
    try {
      if (documentsToUpsert.length > 0) {
        await this.databaseManager.upsertDocuments(documentsToUpsert)
      }
    } catch (e) {
      console.warn('[DocumentIngestion] file ingest failed in batch. Error: ', e)
    }
  }

  private async handleFileAdded(projectId: string, relPath: string) {
    try {
      const stats = await this.filesManager.getFileStats(projectId, relPath)
      if (!stats || !isLikelyText(stats.absolutePath, stats.ext, stats.type)) return

      const content = await this.filesManager.readFile(projectId, relPath)
      if (content) {
        await this.__handleFileAdded(projectId, relPath, content, stats)
      }
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileAdded failed', projectId, relPath, e)
    }
  }

  private async handleFileChanged(projectId: string, relPath: string) {
    return this.handleFileAdded(projectId, relPath)
  }

  private async handleFileDeleted(projectId: string, relPath: string) {
    try {
      const d = await this.databaseManager.getDocumentBySrc(projectId, toRelUnix(relPath))
      if (d?.id) await this.databaseManager.deleteDocument(d.id)
    } catch (e) {
      console.warn('[DocumentIngestion] handleFileDeleted failed', projectId, relPath, e)
    }
  }

  private createDocumentInput(
    projectId: string,
    relPath: string,
    content: string,
    stats: FileMeta,
  ): DocumentInput {
    const type = classifyDocumentType(relPath, stats.ext)

    const name = path.basename(relPath)
    const src = toRelUnix(relPath)

    return {
      projectId,
      type,
      src,
      name,
      content,
      metadata: {
        ext: stats.ext,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
      },
    }
  }

  private async __handleFileAdded(
    projectId: string,
    relPath: string,
    content: string,
    stats: FileMeta,
  ): Promise<Document | undefined> {
    const input = this.createDocumentInput(projectId, relPath, content, stats)

    return await this.databaseManager.upsertDocument(input)
  }

  private async _ensureHandling(projectId: string): Promise<void> {
    if (!this.handling[projectId]) {
      await this.filesManager.addChangeHandler(projectId, async (update) => {
        switch (update.type) {
          case 'addFile': {
            await this.handleFileAdded(projectId, update.relativePath)
            break
          }
          case 'change': {
            await this.handleFileChanged(projectId, update.relativePath)
            break
          }
          case 'deleteFile': {
            await this.handleFileDeleted(projectId, update.relativePath)
            break
          }
        }
      })
      this.handling[projectId] = true
    }
  }
}
