import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import {
  createProjectTools,
  ProjectSpec,
  ProjectSpecCreateInput,
  ProjectSpecEditInput,
  ProjectTools,
  ReorderPayload,
} from 'thefactory-tools'

export default class ProjectsManager extends BaseManager {
  private tools: ProjectTools

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
    this.tools = createProjectTools(this.projectRoot)
  }

  async init(): Promise<void> {
    this.tools.subscribe((projectUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, projectUpdate)
      }
    })
    await super.init()
  }


  private __notify(msg: string) {
    if (msg) console.log(msg) //TODO: change into a logger
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE)
    }
  }
  getHandlers(): Record<string, (args: any) => any> {
    const handlers: Record<string, (args: any) => any> = {}

    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = () => this.listProjects()
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = ({ projectId }) => this.getProject(projectId)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = ({ input }) => this.createProject(input)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = ({ projectId, patch }) =>
      this.updateProject(projectId, patch)
    handlers[IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER] = async ({ projectId, payload }) =>
      this.reorderTask(projectId, payload)

    return handlers
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = ({ projectId }) =>
      this.tools.deleteProject(projectId)

    return handlers
  }

  async getProjectDir(projectId: string): Promise<string | undefined> {
    return this.tools.getProjectDir(projectId)
  }
  async listProjects(): Promise<ProjectSpec[]> {
    return this.tools.listProjects()
  }
  async getProject(projectId: string): Promise<ProjectSpec | undefined> {
    return this.tools.getProject(projectId)
  }
  async createProject(input: ProjectSpecCreateInput): Promise<ProjectSpec | undefined> {
    const p = await this.tools.createProject(input)
    if (p) {
      this.__notify(`New project created: ${p.id}`)
    }
    return p
  }
  async updateProject(
    projectId: string,
    patch: ProjectSpecEditInput,
  ): Promise<ProjectSpec | undefined> {
    const p = await this.tools.updateProject(projectId, patch)
    if (p) {
      this.__notify(`Project updated: ${projectId}`)
    }
    return p
  }
  async deleteProject(projectId: string): Promise<void> {
    await this.tools.deleteProject(projectId)
    this.__notify(`Project ${projectId} deleted`)
  }
  async getTaskIdFromIndex(projectId: string, index: number): Promise<string | undefined> {
    return await this.tools.getTaskIdFromIndex(projectId, index)
  }
  async reorderTask(projectId: string, payload: ReorderPayload): Promise<ProjectSpec | undefined> {
    const p = await this.tools.reorderTask(projectId, payload)
    if (p) {
      this.__notify(`Tasks reordered in project: ${projectId}`)
    }
    return p
  }
}
