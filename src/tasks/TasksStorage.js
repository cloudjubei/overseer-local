import fs from 'fs/promises'
import path from 'path'
import chokidar from 'chokidar'
import { validateTask } from './TasksValidator'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import { randomUUID } from 'crypto'

async function pathExists(p) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export default class TasksStorage {
  constructor(projectId, tasksDir, window) {
    this.projectId = projectId
    this.tasksDir = tasksDir
    this.window = window
    this.watcher = null

    this.tasks = []
  }

  async init() {
    await this.__buildIndex()
    await this.__startWatcher()
  }

  async __startWatcher() {
    if (this.watcher) this.stopWatching()
    if (!(await pathExists(this.tasksDir))) return
    this.watcher = chokidar.watch(path.join(this.tasksDir, '*/task.json'), {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    })
    this.watcher
      .on('add', (p) => this.__rebuildAndNotify(`File added: ${p}`))
      .on('change', (p) => this.__rebuildAndNotify(`File changed: ${p}`))
      .on('unlink', (p) => this.__rebuildAndNotify(`File removed: ${p}`))
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  __notify(msg) {
    if (msg) console.log(msg)
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, this.tasks)
    }
  }
  async __rebuildAndNotify(msg) {
    await this.__buildIndex()
    this.__notify(msg)
  }

  async __buildIndex() {
    try {
      if (await pathExists(this.tasksDir)) {
        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true })
        const tasks = []
        for (const dirent of taskDirs) {
          if (dirent.isDirectory()) {
            const taskId = dirent.name
            const taskFilePath = path.join(this.tasksDir, taskId, 'task.json')
            try {
              const content = await fs.readFile(taskFilePath, 'utf-8')
              const task = JSON.parse(content)
              if (task.id !== taskId) {
                continue
              }
              const { valid, errors } = validateTask(task)
              if (!valid) {
                continue
              }
              tasks.push(task)
            } catch (err) {}
          }
        }
        this.tasks = tasks
      }
    } catch (err) {}
  }

  async listTasks() {
    return this.tasks
  }

  async getTask(id) {
    return this.tasks.find((t) => t.id == id)
  }

  async createTask(task) {
    const newId = randomUUID()

    const newTask = {
      id: newId,
      status: task.status || '-',
      title: task.title || '',
      description: task.description || '',
      features: [],
      rejection: task.rejection,
      featureIdToDisplayIndex: {},
      blockers: task.blockers,
    }

    const { valid, errors } = validateTask(newTask)
    if (!valid) {
      throw new Error(`Invalid new task: ${errors.join(', ')}`)
    }

    const newTaskDir = path.join(this.tasksDir, newId)
    await fs.mkdir(newTaskDir, { recursive: true })

    const taskPath = path.join(newTaskDir, 'task.json')
    await fs.writeFile(taskPath, JSON.stringify(newTask, null, 2), 'utf-8')

    this.tasks.push(newTask)
    await this.__notify(`New task ${newId} added.`)
    return newTask
  }

  async updateTask(taskId, data) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json')
    let taskData
    try {
      const raw = await fs.readFile(taskPath, 'utf-8')
      taskData = JSON.parse(raw)
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`)
    }

    const { id, features, ...patchable } = data || {}
    const next = { ...taskData, ...patchable }

    const { valid, errors } = validateTask(next)
    if (!valid) {
      throw new Error(`Invalid task update for ${taskId}: ${errors.join(', ')}`)
    }

    await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8')
    this.tasks = this.tasks.map((t) => (t.id === next.id ? next : t))

    await this.__notify(`Task ${taskId} updated.`)
    return { ok: true }
  }

  async deleteTask(taskId) {
    const taskDirPath = path.join(this.tasksDir, taskId)
    try {
      await fs.rm(taskDirPath, { recursive: true, force: true })
    } catch (e) {
      throw new Error(`Could not delete task directory for task ${taskId}: ${e.message}`)
    }

    this.tasks = this.tasks.filter((t) => t.id !== taskId)

    await this.__notify(`Task ${taskId} deleted.`)
    return { ok: true }
  }

  async getFeature(taskId, featureId) {
    const task = await this.getTask(taskId)
    if (!task) return null
    return task.features.find((f) => f.id === featureId)
  }

  async addFeature(taskId, feature) {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }

    const newId = randomUUID()
    const newFeature = {
      id: newId,
      status: feature.status || '-',
      title: feature.title || '',
      description: feature.description || '',
      plan: feature.plan || '',
      context: feature.context || [],
      acceptance: feature.acceptance || [],
      blockers: feature.blockers,
      rejection: feature.rejection,
    }
    task.features.push(newFeature)
    task.featureIdToDisplayIndex[newId] = task.features.length

    const { valid, errors } = validateTask(task)
    if (!valid) {
      throw new Error(`Invalid task after adding feature: ${errors.join(', ')}`)
    }

    const taskPath = path.join(this.tasksDir, taskId, 'task.json')
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8')
    await this.__notify(`Feature added to task ${taskId}.`)
    return { ok: true, id: newId }
  }

  async updateFeature(taskId, featureId, data) {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }

    const { id, ...patchable } = data || {}
    task.features = task.features.map((f) => (f.id === featureId ? { ...f, ...patchable } : f))

    const { valid, errors } = validateTask(task)
    if (!valid) {
      throw new Error(`Invalid task update for ${taskId}: ${errors.join(', ')}`)
    }

    const taskPath = path.join(this.tasksDir, taskId, 'task.json')
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8')
    await this.__notify(`Feature ${featureId} updated in task ${taskId}`)
    return { ok: true }
  }

  async deleteFeature(taskId, featureId) {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }

    const featureIndex = task.features.findIndex((f) => f.id === featureId)
    if (featureIndex === -1) {
      throw new Error(`Feature ${featureId} not found in task ${taskId}`)
    }
    task.features.splice(featureIndex, 1)

    const index = task.featureIdToDisplayIndex[featureId]
    delete task.featureIdToDisplayIndex[featureId]
    for (const key of Object.keys(task.featureIdToDisplayIndex)) {
      if (task.featureIdToDisplayIndex[key] > index) {
        task.featureIdToDisplayIndex[key] = task.featureIdToDisplayIndex[key] - 1
      }
    }

    const taskPath = path.join(this.tasksDir, taskId, 'task.json')
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8')
    await this.__notify(`Feature ${featureId} deleted from task ${taskId}.`)
    return { ok: true }
  }

  async reorderFeatures(taskId, payload) {
    const task = await this.getTask(taskId)
    if (!task) {
      throw new Error(`Task with id: ${taskId} not found`)
    }

    const currentOrder = task.features
      .map((f) => f.id)
      .sort((a, b) => task.featureIdToDisplayIndex[a] - task.featureIdToDisplayIndex[b])

    let newOrder
    if (payload.fromIndex !== undefined && payload.toIndex !== undefined) {
      const fromIndex = payload.fromIndex
      const toIndex = payload.toIndex
      if (fromIndex < 0 || fromIndex >= currentOrder.length) throw new Error('Invalid source index')
      if (toIndex < 0 || toIndex > currentOrder.length) throw new Error('Invalid target index')
      newOrder = [...currentOrder]
      const [moved] = newOrder.splice(fromIndex, 1)
      newOrder.splice(toIndex, 0, moved)
    } else {
      throw new Error('Invalid payload for reorder')
    }

    if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
      return { ok: true }
    }

    const newIndex = {}
    newOrder.forEach((id, i) => {
      newIndex[id] = i + 1
    })
    task.featureIdToDisplayIndex = newIndex

    const taskPath = path.join(this.tasksDir, taskId, 'task.json')
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2), 'utf-8')
    await this.__notify(`Features reordered for task ${taskId}.`)
    return { ok: true }
  }
}
