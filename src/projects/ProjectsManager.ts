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
    await this.tools.init()
    this.tools.subscribe(async (projectUpdate) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, projectUpdate)
      }
    })
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = () => this.listProjects()
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = ({ projectId }) => this.getProject(projectId)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = ({ input }) => this.createProject(input)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = ({ projectId, patch }) =>
      this.updateProject(projectId, patch)
    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = ({ projectId }) =>
      this.tools.deleteProject(projectId)
    handlers[IPC_HANDLER_KEYS.PROJECTS_STORY_REORDER] = async ({ projectId, payload }) =>
      this.reorderStory(projectId, payload)

    return handlers
  }

  async getProjectDir(projectId: string): Promise<string | undefined> {
    return await this.tools.getProjectDir(projectId)
  }
  async listProjects(): Promise<ProjectSpec[]> {
    return await this.tools.listProjects()
  }
  async getProject(projectId: string): Promise<ProjectSpec | undefined> {
    return await this.tools.getProject(projectId)
  }
  async createProject(input: ProjectSpecCreateInput): Promise<ProjectSpec | undefined> {
    return await this.tools.createProject(input)
  }
  async updateProject(
    projectId: string,
    patch: ProjectSpecEditInput,
  ): Promise<ProjectSpec | undefined> {
    return await this.tools.updateProject(projectId, patch)
  }
  async deleteProject(projectId: string): Promise<void> {
    return await this.tools.deleteProject(projectId)
  }
  async getStoryIdFromIndex(projectId: string, index: number): Promise<string | undefined> {
    return await this.tools.getStoryIdFromIndex(projectId, index)
  }
  async reorderStory(projectId: string, payload: ReorderPayload): Promise<ProjectSpec | undefined> {
    return await this.tools.reorderStory(projectId, payload)
  }
}
