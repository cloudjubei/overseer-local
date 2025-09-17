import { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { createTaskTools, Feature, Task, TaskTools } from 'thefactory-tools'

export default class TasksStorage {
  private projectRoot: string
  private window: BrowserWindow
  private taskTools: TaskTools

  constructor(projectRoot: string, window: BrowserWindow) {
    this.projectRoot = projectRoot
    this.window = window

    this.taskTools = createTaskTools(projectRoot)
  }

  async init() {}
  stopWatching() {}

  async __notify(msg: string) {
    if (msg) console.log(msg)
    if (this.window) {
      const tasks = await this.listTasks()
      this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, tasks)
    }
  }

  async listTasks() {
    return await this.taskTools.listTasks()
  }

  async getTask(id: string) {
    return this.taskTools.getTask(id)
  }

  async createTask(task: Task) {
    await this.taskTools.saveTask(task)

    await this.__notify(`New task ${task.id} added.`)
    return task
  }

  async updateTask(taskId: string, data: Partial<Task>) {
    const next = await this.taskTools.updateTask(taskId, data)

    await this.__notify(`Task ${taskId} updated.`)
    return { ok: true }
  }

  async deleteTask(taskId: string) {
    await this.taskTools.deleteTask(taskId)

    await this.__notify(`Task ${taskId} deleted.`)
    return { ok: true }
  }

  async getFeature(taskId: string, featureId: string) {
    return await this.taskTools.getFeature(taskId, featureId)
  }

  async addFeature(taskId: string, feature: Partial<Feature>) {
    const task = await this.taskTools.addFeature(taskId, feature)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature added to task ${taskId}.`)
    return { ok: true }
  }

  async updateFeature(taskId: string, featureId: string, data: Partial<Feature>) {
    const task = await this.taskTools.updateFeature(taskId, featureId, data)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature ${featureId} updated in task ${taskId}`)
    return { ok: true }
  }

  async deleteFeature(taskId: string, featureId: string) {
    const task = await this.taskTools.deleteFeature(taskId, featureId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature ${featureId} deleted from task ${taskId}.`)
    return { ok: true }
  }

  async reorderFeatures(taskId: string, payload: { fromIndex: number; toIndex: number }) {
    const task = this.taskTools.reorderFeatures(taskId, payload)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Features reordered for task ${taskId}.`)
    return { ok: true }
  }
}
