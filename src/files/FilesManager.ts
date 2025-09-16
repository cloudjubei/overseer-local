import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import path from 'path'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import FilesStorage from './FilesStorage'
import type { BaseManager } from '../managers'
import type ProjectsManager from '../projects/ProjectsManager'

export default class FilesManager implements BaseManager {
  private window: BrowserWindow
  private storages: Record<string, FilesStorage>
  private _ipcBound: boolean
  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    this.window = window
    this.storages = {}
    this._ipcBound = false

    this.projectsManager = projectsManager
  }

  async init(): Promise<void> {
    await this.__getStorage('main')

    this._registerIpcHandlers()
  }

  private async __getStorage(projectId: string): Promise<FilesStorage | undefined> {
    if (!this.storages[projectId]) {
      const project: any = await this.projectsManager.getProject(projectId as any)
      if (!project) {
        return
      }
      const projectRoot = path.resolve(this.projectsManager.projectsDir, project.path)
      const filesDir = projectRoot
      const storage = new FilesStorage(projectId, filesDir, this.window)
      await storage.init()
      this.storages[projectId] = storage
    }
    return this.storages[projectId]
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => Promise<any> | any> = {}
    handlers[IPC_HANDLER_KEYS.FILES_LIST] = async ({ projectId }) =>
      (await this.__getStorage(projectId))?.listFiles()
    handlers[IPC_HANDLER_KEYS.FILES_READ] = async ({ projectId, relPath, encoding }) =>
      await this.readFile(projectId, relPath, encoding)
    handlers[IPC_HANDLER_KEYS.FILES_READ_BINARY] = async ({ projectId, relPath }) =>
      (await this.__getStorage(projectId))?.readFileBinary(relPath)
    handlers[IPC_HANDLER_KEYS.FILES_READ_DIRECTORY] = async ({ projectId, relPath }) =>
      (await this.__getStorage(projectId))?.readDirectory(relPath)
    handlers[IPC_HANDLER_KEYS.FILES_WRITE] = async ({ projectId, relPath, content, encoding }) =>
      await this.writeFile(projectId, relPath, content, encoding)
    handlers[IPC_HANDLER_KEYS.FILES_DELETE] = async ({ projectId, relPath }) =>
      (await this.__getStorage(projectId))?.deleteFile(relPath)
    handlers[IPC_HANDLER_KEYS.FILES_RENAME] = async ({ projectId, relPathSource, relPathTarget }) =>
      (await this.__getStorage(projectId))?.renameFile(relPathSource, relPathTarget)
    handlers[IPC_HANDLER_KEYS.FILES_UPLOAD] = async ({ projectId, name, content }) =>
      (await this.__getStorage(projectId))?.uploadFile(name, content)

    for (const handler of Object.keys(handlers)) {
      ipcMain.handle(handler, async (_event, args) => {
        try {
          return await handlers[handler](args)
        } catch (e: any) {
          console.error(`${handler} failed`, e)
          return { ok: false, error: String(e?.message || e) }
        }
      })
    }

    this._ipcBound = true
  }

  async getAbsoluteFilePath(projectId: string, relativePath: string): Promise<string> {
    const s = await this.__getStorage(projectId)
    return s!.getAbsolutePath(relativePath)
  }
  async listFiles(projectId: string): Promise<any> {
    const s = await this.__getStorage(projectId)
    return await s?.listFiles()
  }
  async readFile(projectId: string, relPath: string, encoding: BufferEncoding | 'utf8' = 'utf8') {
    const s = await this.__getStorage(projectId)
    return await s?.readFile(relPath, encoding)
  }
  async getFileStats(projectId: string, relPath: string): Promise<any> {
    const s = await this.__getStorage(projectId)
    const absolutePath = s?.getAbsolutePath(relPath)
    return await s?.getFileStats(absolutePath)
  }
  async writeFile(
    projectId: string,
    relPath: string,
    content: string | Buffer,
    encoding: BufferEncoding | 'utf8' = 'utf8',
  ) {
    const s = await this.__getStorage(projectId)
    return await s?.writeFile(relPath, content, encoding)
  }

  async addChangeHandler(projectId: string, handler: any): Promise<void> {
    const s = await this.__getStorage(projectId)
    s?.addChangeHandler(handler)
  }
}
