import { ipcMain } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { isCodeFile, classifyDocumentType } from '../db/fileTyping'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'

export class DocumentIngestionManager {
  constructor(projectRoot, window, dbManager, projectsManager, filesManager) {
    this.projectRoot = projectRoot
    this.window = window

    this.dbManager = dbManager
    this.projectsManager = projectsManager
    this.filesManager = filesManager

    this.handling = {}
  }

  async init() {
    this._registerIpcHandlers()
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return

    const handlers = {}
    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_ALL] = async () => await this.ingestAll()
    handlers[IPC_HANDLER_KEYS.DOCUMENT_INGESTION_PROJECT] = async ({ id }) =>
      await this.ingestProject(id)

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

  getDocumentType(ext, relPath) {
    return isCodeFile(ext, relPath) ? 'project_code' : 'project_file'
  }
  async ingestProject(projectId) {
    console.info('[DocumentIngestionService] ingestProject: ', projectId)
    await this._ensureHandling(projectId)
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      console.warn('[DocumentIngestionService] syncProject: missing project', projectId)
      return { ok: false, error: 'Project not found' }
    }
    //TODO:
  }

  async ingestAll() {
    const projects = await this.projectsManager.listProjects()
    const results = {}
    for (const p of projects) {
      results[p.id] = await this.ingestProject(p.id)
    }
    return results
  }

  async handleFileAdded({ projectId, relPath }) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: 'Project not found' }
    //TODO:
  }

  async handleFileChanged({ projectId, relPath }) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: 'Project not found' }
    //TODO:
  }

  async handleFileRenamed({ projectId, relPath }) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: 'Project not found' }
    //TODO:
  }

  async handleFileDeleted({ projectId, relPath }) {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) return { ok: false, error: 'Project not found' }
    //TODO:
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
