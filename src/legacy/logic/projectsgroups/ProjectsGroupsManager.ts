import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../../preload/ipcHandlersKeys'
import {
  createProjectsGroupsTools,
  ProjectsGroup,
  ProjectsGroups,
  ProjectsGroupCreateInput,
  ProjectsGroupEditInput,
  ProjectsGroupsTools,
  ReorderPayload,
} from 'thefactory-tools'
import BaseManager from '../BaseManager'

export default class ProjectsGroupsManager extends BaseManager {
  private tools: ProjectsGroupsTools

  constructor(projectRoot: string, window: BrowserWindow) {
    super(projectRoot, window)
    this.tools = createProjectsGroupsTools(this.projectRoot)
  }

  async init(): Promise<void> {
    await this.tools.init()
    this.tools.subscribe(async (update) => {
      if (this.window) {
        this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTSGROUPS_SUBSCRIBE, update)
      }
    })
    await super.init()
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_LIST] = () => this.listProjestsGroups()
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_GET] = ({ groupId }) => this.getProjectsGroup(groupId)
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_CREATE] = ({ input }) =>
      this.createProjectsGroup(input)
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_UPDATE] = ({ groupId, patch }) =>
      this.updateProjectsGroup(groupId, patch)
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_DELETE] = ({ groupId }) =>
      this.tools.deleteProjectsGroup(groupId)
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_PROJECT_REORDER] = async ({ groupId, payload }) =>
      this.reorderProject(groupId, payload)
    handlers[IPC_HANDLER_KEYS.PROJECTSGROUPS_GROUP_REORDER] = async ({ payload }) =>
      this.reorderGroup(payload)

    return handlers
  }

  async listProjestsGroups(): Promise<ProjectsGroups> {
    return await this.tools.getProjectsGroups()
  }
  async getProjectsGroup(groupId: string): Promise<ProjectsGroup | undefined> {
    return await this.tools.getProjectsGroup(groupId)
  }
  async createProjectsGroup(input: ProjectsGroupCreateInput): Promise<ProjectsGroup | undefined> {
    return await this.tools.createProjectsGroup(input)
  }
  async updateProjectsGroup(
    groupId: string,
    patch: ProjectsGroupEditInput,
  ): Promise<ProjectsGroup | undefined> {
    return await this.tools.updateProjectsGroup(groupId, patch)
  }
  async deleteProjectsGroup(groupId: string): Promise<ProjectsGroups> {
    return await this.tools.deleteProjectsGroup(groupId)
  }
  async getProjectIdFromIndex(groupId: string, index: number): Promise<string | undefined> {
    return await this.tools.getProjectIdFromIndex(groupId, index)
  }
  async reorderProject(
    groupId: string,
    payload: ReorderPayload,
  ): Promise<ProjectsGroup | undefined> {
    return await this.tools.reorderProject(groupId, payload)
  }
  async reorderGroup(payload: ReorderPayload): Promise<ProjectsGroups> {
    return await this.tools.reorderGroup(payload)
  }
}
