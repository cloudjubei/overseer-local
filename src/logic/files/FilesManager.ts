import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import type ProjectsManager from '../projects/ProjectsManager'
import {
  createFileTools,
  FileTools,
  FilesResult,
  getFileStats as getFileMetaStats,
  FileMeta,
  FileChangeHandler,
} from 'thefactory-tools'
import DatabaseManager from '../db/DatabaseManager'
import Mutex from '../utils/Mutex'
import BaseManager from '../BaseManager'

export default class FilesManager extends BaseManager {
  private toolsLock = new Mutex()
  private tools: Record<string, FileTools> = {}
  private projectsManager: ProjectsManager
  private databaseManager: DatabaseManager

  constructor(
    projectRoot: string,
    window: BrowserWindow,
    projectsManager: ProjectsManager,
    databaseManager: DatabaseManager,
  ) {
    super(projectRoot, window)

    this.projectsManager = projectsManager
    this.databaseManager = databaseManager
  }

  async init(): Promise<void> {
    await this.__getTools('main')

    await super.init()
  }

  async updateTools(): Promise<void> {
    for (const projectId in Object.keys(this.tools)) {
      await this.updateTool(projectId)
    }
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.FILES_LIST] = ({ projectId, relPath }) =>
      this.listFiles(projectId, relPath)
    handlers[IPC_HANDLER_KEYS.FILES_READ_FILE] = ({ projectId, relPath, encoding }) =>
      this.readFile(projectId, relPath, encoding)
    handlers[IPC_HANDLER_KEYS.FILES_READ_PATHS] = ({ projectId, pathsRel }) =>
      this.readPaths(projectId, pathsRel)
    handlers[IPC_HANDLER_KEYS.FILES_GET_ALL_STATS] = ({ projectId }) =>
      this.getAllFileStats(projectId)
    handlers[IPC_HANDLER_KEYS.FILES_WRITE_FILE] = ({ projectId, relPath, content, encoding }) =>
      this.writeFile(projectId, relPath, content, encoding)
    handlers[IPC_HANDLER_KEYS.FILES_RENAME_PATH] = ({ projectId, srcRel, dstRel }) =>
      this.renamePath(projectId, srcRel, dstRel)
    handlers[IPC_HANDLER_KEYS.FILES_DELETE_PATH] = ({ projectId, relPath }) =>
      this.deletePath(projectId, relPath)
    handlers[IPC_HANDLER_KEYS.FILES_SEARCH] = async ({ projectId, query, relPath }) =>
      this.searchFiles(projectId, query, relPath)
    handlers[IPC_HANDLER_KEYS.FILES_UPLOAD_FILE] = async ({ projectId, name, content }) =>
      this.uploadFile(projectId, name, content)

    return handlers
  }

  async listFiles(projectId: string, relPath: string = '.'): Promise<string[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.listContents(relPath)) ?? []
  }
  async readFile(
    projectId: string,
    relPath: string,
    encoding: BufferEncoding = 'utf8',
  ): Promise<string | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.readFile(relPath, encoding)
  }

  async readPaths(projectId: string, pathsRel: string[]): Promise<FilesResult | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.readPaths(pathsRel)
  }

  async getAllFileStats(projectId: string): Promise<FileMeta[]> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return []
    }
    return tools.getAllFileStats()
  }

  async writeFile(
    projectId: string,
    relPath: string,
    content: string | Buffer,
    encoding: BufferEncoding = 'utf8',
  ) {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    await tools.writeFile(relPath, content, encoding)
  }
  async renamePath(projectId: string, srcRel: string, dstRel: string) {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    await tools.renamePath(srcRel, dstRel)
  }
  async deletePath(projectId: string, relPath: string) {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    await tools.deletePath(relPath)
  }
  async searchFiles(projectId: string, query: string, relPath: string = '.') {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.searchFiles(query, relPath)
  }
  async uploadFile(
    projectId: string,
    name: string,
    content: string | Buffer,
  ): Promise<string | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.uploadFile(name, content)
  }

  async getFileStats(projectId: string, relPath: string): Promise<FileMeta | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const absolutePath = tools.getAbsolutePath(relPath)
    return getFileMetaStats(absolutePath)
  }

  async addChangeHandler(projectId: string, handler: FileChangeHandler): Promise<void> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    tools.subscribe(handler)
  }

  private async updateTool(projectId: string): Promise<FileTools | undefined> {
    const projectRoot = await this.projectsManager.getProjectDir(projectId)
    if (!projectRoot) {
      return
    }
    const connectionString = this.databaseManager.getConnectionString()

    const tools = createFileTools(projectId, projectRoot, connectionString)
    await tools.init()
    this.tools[projectId] = tools

    tools.subscribe(async (fileUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.FILES_SUBSCRIBE, fileUpdate)
      }
    })
    return tools
  }
  private async __getTools(projectId: string): Promise<FileTools | undefined> {
    await this.toolsLock.lock()
    if (!this.tools[projectId]) {
      await this.updateTool(projectId)
    }
    this.toolsLock.unlock()
    return this.tools[projectId]
  }
}
