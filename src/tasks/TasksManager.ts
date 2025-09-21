import type { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import BaseManager from '../BaseManager'
import type ProjectsManager from '../projects/ProjectsManager'
import {
  createTaskTools,
  Feature,
  FeatureCreateInput,
  FeatureEditInput,
  ProjectSpec,
  ReorderPayload,
  Task,
  TaskCreateInput,
  TaskEditInput,
  TaskTools,
} from 'thefactory-tools'

export default class TasksManager extends BaseManager {
  private tools: Record<string, TaskTools>

  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    super(projectRoot, window)
    this.tools = {}

    this.projectsManager = projectsManager
  }

  async init(): Promise<void> {
    await this.__getTools('main')

    await super.init()
  }

  private async __getTools(projectId: string): Promise<TaskTools | undefined> {
    if (!this.tools[projectId]) {
      const projectRoot = await this.projectsManager.getProjectDir(projectId)
      if (!projectRoot) {
        return
      }

      this.tools[projectId] = createTaskTools(projectRoot)
    }
    return this.tools[projectId]
  }

  private __notify(msg: string) {
    if (msg) console.log(msg) //TODO: change into a logger
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE)
    }
  }

  getHandlersAsync(): Record<string, (args: any) => Promise<any>> {
    const handlers: Record<string, (args: any) => Promise<any>> = {}

    handlers[IPC_HANDLER_KEYS.TASKS_LIST] = ({ projectId }) => this.listTasks(projectId)
    handlers[IPC_HANDLER_KEYS.TASKS_GET] = ({ projectId, taskId }) =>
      this.getTask(projectId, taskId)
    handlers[IPC_HANDLER_KEYS.TASKS_CREATE] = ({ projectId, input }) =>
      this.createTask(projectId, input)
    handlers[IPC_HANDLER_KEYS.TASKS_UPDATE] = ({ projectId, taskId, patch }) =>
      this.updateTask(projectId, taskId, patch)
    handlers[IPC_HANDLER_KEYS.TASKS_DELETE] = ({ projectId, taskId }) =>
      this.deleteTask(projectId, taskId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_GET] = ({ projectId, taskId, featureId }) =>
      this.getFeature(projectId, taskId, featureId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_ADD] = ({ projectId, taskId, input }) =>
      this.addFeature(projectId, taskId, input)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE] = ({ projectId, taskId, featureId, patch }) =>
      this.updateFeature(projectId, taskId, featureId, patch)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE] = ({ projectId, taskId, featureId }) =>
      this.deleteFeature(projectId, taskId, featureId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER] = ({ projectId, taskId, payload }) =>
      this.reorderFeatures(projectId, taskId, payload)

    return handlers
  }

  async listTasks(projectId: string): Promise<Task[]> {
    const tools = await this.__getTools(projectId)
    return (await tools?.listTasks()) ?? []
  }
  async getTask(projectId: string, taskId: string): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (tools) {
      return tools.getTask(taskId)
    }
  }
  async createTask(projectId: string, taskData: TaskCreateInput): Promise<Task | undefined> {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }

    const newTask = await tools.createTask(taskData)

    const newProject = { ...project }
    newProject.taskIdToDisplayIndex[newTask.id] =
      Object.keys(newProject.taskIdToDisplayIndex).length + 1
    await this.projectsManager.updateProject(project.id, newProject)
    this.__notify(`New task added: ${newTask.id} : ${newTask.title}`)
    return newTask
  }
  async updateTask(
    projectId: string,
    taskId: string,
    patch: TaskEditInput,
  ): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (tools) {
      const t = await tools.updateTask(taskId, patch)
      if (t) {
        this.__notify(`Task updated: ${t.id}`)
      }
      return t
    }
  }

  async deleteTask(projectId: string, taskId: string): Promise<ProjectSpec | undefined> {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) {
      return
    }
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    await tools.deleteTask(taskId)

    const newProject = { ...project }
    const index = newProject.taskIdToDisplayIndex[taskId]
    delete newProject.taskIdToDisplayIndex[taskId]
    for (const key of Object.keys(newProject.taskIdToDisplayIndex)) {
      if (newProject.taskIdToDisplayIndex[key] > index) {
        newProject.taskIdToDisplayIndex[key] = newProject.taskIdToDisplayIndex[key] - 1
      }
    }
    await this.projectsManager.updateProject(projectId, newProject)
    this.__notify('Task was deleted')
    return newProject
  }

  async getFeature(
    projectId: string,
    taskId: string,
    featureId: string,
  ): Promise<Feature | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    return await tools.getFeature(taskId, featureId)
  }
  async addFeature(
    projectId: string,
    taskId: string,
    input: FeatureCreateInput,
  ): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.addFeature(taskId, input)
    if (t) {
      this.__notify(`New feature added to task: ${t.id}`)
    }
    return t
  }
  async updateFeature(
    projectId: string,
    taskId: string,
    featureId: string,
    patch: FeatureEditInput,
  ): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.updateFeature(taskId, featureId, patch)
    if (t) {
      this.__notify(`Feature: ${featureId} updated in task: ${t.id}`)
    }
    return t
  }
  async deleteFeature(
    projectId: string,
    taskId: string,
    featureId: string,
  ): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.deleteFeature(taskId, featureId)
    if (t) {
      this.__notify(`Feature delete from task: ${t.id}`)
    }
    return t
  }
  async reorderFeatures(
    projectId: string,
    taskId: string,
    payload: ReorderPayload,
  ): Promise<Task | undefined> {
    const tools = await this.__getTools(projectId)
    if (!tools) {
      return
    }
    const t = await tools.reorderFeatures(taskId, payload)
    if (t) {
      this.__notify(`Features reordered in task: ${t.id}`)
    }
    return t
  }
}
