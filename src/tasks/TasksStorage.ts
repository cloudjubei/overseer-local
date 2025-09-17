import { BrowserWindow } from 'electron'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import {
  createTaskTools,
  FeatureCreateInput,
  FeatureEditInput,
  TaskCreateInput,
  TaskEditInput,
  TaskTools,
} from 'thefactory-tools'

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

  async createTask(input: TaskCreateInput) {
    const task = this.taskTools.createTask(input)

    await this.__notify(`New task ${task.id} added.`)
    return task
  }

  async updateTask(taskId: string, patch: TaskEditInput) {
    const next = this.taskTools.updateTask(taskId, patch)

    await this.__notify(`Task ${taskId} updated.`)
    return next
  }

  async deleteTask(taskId: string) {
    await this.taskTools.deleteTask(taskId)

    await this.__notify(`Task ${taskId} deleted.`)
  }

  async getFeature(taskId: string, featureId: string) {
    return await this.taskTools.getFeature(taskId, featureId)
  }

  async addFeature(taskId: string, input: FeatureCreateInput) {
    const task = this.taskTools.addFeature(taskId, input)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature added to task ${taskId}.`)
    return task
  }

  async updateFeature(taskId: string, featureId: string, patch: FeatureEditInput) {
    const task = this.taskTools.updateFeature(taskId, featureId, patch)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature ${featureId} updated in task ${taskId}`)
    return task
  }

  async deleteFeature(taskId: string, featureId: string) {
    const task = this.taskTools.deleteFeature(taskId, featureId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Feature ${featureId} deleted from task ${taskId}.`)
    return task
  }

  async reorderFeatures(taskId: string, payload: { fromIndex: number; toIndex: number }) {
    const task = this.taskTools.reorderFeatures(taskId, payload)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }
    await this.__notify(`Features reordered for task ${taskId}.`)
    return task
  }
}
