import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import path from 'path'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import TasksStorage from './TasksStorage'
import type { BaseManager } from '../managers'
import type ProjectsManager from '../projects/ProjectsManager'

function resolveTasksDir(projectRoot: string) {
  return path.join(projectRoot, '.tasks')
}

export default class TasksManager implements BaseManager {
  private projectRoot: string
  private window: BrowserWindow
  private storages: Record<string, TasksStorage>
  private _ipcBound: boolean

  private projectsManager: ProjectsManager

  constructor(projectRoot: string, window: BrowserWindow, projectsManager: ProjectsManager) {
    this.projectRoot = projectRoot
    this.window = window
    this.storages = {}
    this._ipcBound = false

    this.projectsManager = projectsManager
  }

  private async __getStorage(projectId: string): Promise<TasksStorage | undefined> {
    if (!this.storages[projectId]) {
      const project: any = await this.projectsManager.getProject(projectId as any)
      if (!project) {
        return
      }
      const projectRoot = path.resolve(this.projectsManager.projectsDir, project.path)
      const tasksDir = resolveTasksDir(projectRoot)
      const storage = new TasksStorage(projectId, tasksDir, this.window)
      await storage.init()
      this.storages[projectId] = storage
    }
    return this.storages[projectId]
  }

  async init(): Promise<void> {
    await this.__getStorage('main')

    this._registerIpcHandlers()
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => Promise<any> | any> = {}
    handlers[IPC_HANDLER_KEYS.TASKS_LIST] = async ({ projectId }) => await this.listTasks(projectId)
    handlers[IPC_HANDLER_KEYS.TASKS_GET] = async ({ projectId, id }) =>
      await this.getTask(projectId, id)
    handlers[IPC_HANDLER_KEYS.TASKS_CREATE] = async ({ projectId, task }) =>
      await this.createTask(projectId, task)
    handlers[IPC_HANDLER_KEYS.TASKS_UPDATE] = async ({ projectId, taskId, data }) =>
      (await this.__getStorage(projectId))?.updateTask(taskId, data)
    handlers[IPC_HANDLER_KEYS.TASKS_DELETE] = async ({ projectId, taskId }) =>
      await this.deleteTask(projectId, taskId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_GET] = async ({ projectId, taskId, featureId }) =>
      await this.getFeature(projectId, taskId, featureId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_ADD] = async ({ projectId, taskId, feature }) =>
      (await this.__getStorage(projectId))?.addFeature(taskId, feature)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE] = async ({
      projectId,
      taskId,
      featureId,
      data,
    }) => (await this.__getStorage(projectId))?.updateFeature(taskId, featureId, data)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE] = async ({ projectId, taskId, featureId }) =>
      (await this.__getStorage(projectId))?.deleteFeature(taskId, featureId)
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER] = async ({ projectId, taskId, payload }) =>
      (await this.__getStorage(projectId))?.reorderFeatures(taskId, payload)

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

  async listTasks(projectId: string): Promise<any> {
    const s = await this.__getStorage(projectId)
    return await s?.listTasks()
  }
  async getTask(projectId: string, id: string): Promise<any> {
    const s = await this.__getStorage(projectId)
    return await s?.getTask(id)
  }

  async createTask(projectId: string, taskData: any): Promise<any> {
    const project: any = await this.projectsManager.getProject(projectId as any)
    if (!project) {
      return { ok: false, error: "project couldn't be found" }
    }

    const storage = await this.__getStorage(projectId)
    const newTask = await storage?.createTask(taskData)
    if (!newTask) {
      return { ok: false, error: "task couldn't be created" }
    }

    const newProject = { ...project }
    newProject.taskIdToDisplayIndex[newTask.id] =
      Object.keys(newProject.taskIdToDisplayIndex).length + 1
    await (this.projectsManager as any).updateProject(project.id, newProject)
    return { ok: true }
  }

  async deleteTask(projectId: string, taskId: string): Promise<any> {
    const project: any = await this.projectsManager.getProject(projectId as any)
    if (!project) {
      return { ok: false, error: "project couldn't be found" }
    }

    const storage = await this.__getStorage(projectId)
    await storage?.deleteTask(taskId)

    const newProject = { ...project }
    const index = newProject.taskIdToDisplayIndex[taskId]
    delete newProject.taskIdToDisplayIndex[taskId]
    for (const key of Object.keys(newProject.taskIdToDisplayIndex)) {
      if (newProject.taskIdToDisplayIndex[key] > index) {
        newProject.taskIdToDisplayIndex[key] = newProject.taskIdToDisplayIndex[key] - 1
      }
    }
    await (this.projectsManager as any).updateProject(projectId, newProject)
    return { ok: true }
  }
  async getFeature(projectId: string, taskId: string, featureId: string): Promise<any> {
    const s = await this.__getStorage(projectId)
    return await s?.getFeature(taskId, featureId)
  }
}
