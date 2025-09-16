import fs from 'fs/promises'
import path from 'path'
import chokidar, { FSWatcher } from 'chokidar'
import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { validateProjectSpec } from './ProjectsValidator'
import IPC_HANDLER_KEYS from '../ipcHandlersKeys'
import type { BaseManager } from '../managers'
import { ProjectSpec } from 'thefactory-tools'

async function pathExists(p: string) {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

export default class ProjectsManager implements BaseManager {
  projectRoot: string
  projectsDir: string
  window: BrowserWindow
  watcher: FSWatcher | null
  private _ipcBound: boolean

  private projects: any[]

  constructor(projectRoot: string, window: BrowserWindow) {
    this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot)
    this.projectsDir = path.join(this.projectRoot, '.projects')
    this.window = window
    this.watcher = null
    this._ipcBound = false

    this.projects = []
  }

  async init(): Promise<void> {
    await this.__buildIndex()
    if (await pathExists(this.projectsDir)) {
      this.watcher = chokidar.watch(path.join(this.projectsDir, '/*.json'), {
        ignored: /(^|[\/\\])\../,
        persistent: true,
        ignoreInitial: true,
      })
      this.watcher
        .on('add', (_p) => this.__rebuildAndNotify())
        .on('change', (_p) => this.__rebuildAndNotify())
        .on('unlink', (_p) => this.__rebuildAndNotify())
        .on('addDir', (_p) => this.__rebuildAndNotify())
        .on('unlinkDir', (_p) => this.__rebuildAndNotify())
    }
    this._registerIpcHandlers()
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
  }

  private __notify(): void {
    if (this.window) {
      try {
        this.window.webContents.send(IPC_HANDLER_KEYS.PROJECTS_SUBSCRIBE, this.projects)
      } catch {}
    }
  }
  private async __rebuildAndNotify(): Promise<void> {
    await this.__buildIndex()
    this.__notify()
  }

  private async __buildIndex(): Promise<void> {
    const projectsDirAbs = path.resolve(this.projectsDir)
    const projects: any[] = []

    if (await pathExists(projectsDirAbs)) {
      let entries: any[] = []
      try {
        entries = await fs.readdir(projectsDirAbs, { withFileTypes: true })
      } catch (e: any) {
        // ignore readdir errors other than ENOENT
        return
      }
      for (const entry of entries) {
        const abs = path.join(projectsDirAbs, entry.name)
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
          const project = await this._tryLoadProjectConfig(abs)
          if (project) {
            projects.push(project)
          }
        }
      }
    }

    this.projects = projects
  }

  private async _tryLoadProjectConfig(configAbsPath: string): Promise<any | undefined> {
    let raw: string | undefined
    try {
      raw = await fs.readFile(configAbsPath, 'utf8')
    } catch (e) {
      return
    }

    let json: any
    try {
      json = JSON.parse(raw)
    } catch (e) {
      return
    }

    const { valid } = validateProjectSpec(json)
    if (!valid) {
      return
    }

    return json
  }

  private _registerIpcHandlers(): void {
    if (this._ipcBound) return

    const handlers: Record<string, (args: any) => Promise<any> | any> = {}
    handlers[IPC_HANDLER_KEYS.PROJECTS_LIST] = () => this.listProjects()
    handlers[IPC_HANDLER_KEYS.PROJECTS_GET] = (args) => this.getProject(args.id)
    handlers[IPC_HANDLER_KEYS.PROJECTS_CREATE] = (args) => this.createProject(args.project)
    handlers[IPC_HANDLER_KEYS.PROJECTS_UPDATE] = (args) => this.updateProject(args.id, args.project)
    handlers[IPC_HANDLER_KEYS.PROJECTS_DELETE] = (args) => this.deleteProject(args.id)
    handlers[IPC_HANDLER_KEYS.PROJECTS_TASK_REORDER] = async (args) =>
      this.reorderTask(args.projectId, args.fromIndex, args.toIndex)

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

  async ensureProjectsDirExists(): Promise<string> {
    const dir = this.projectsDir
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {}
    return dir
  }

  getProjectConfigPathForId(id: string): string {
    return path.join(this.projectsDir, `${id}.json`)
  }

  listProjects(): ProjectSpec[] {
    return this.projects
  }

  getProject(id: string): ProjectSpec | undefined {
    return this.projects.find((p) => p.id === id)
  }

  async createProject(spec: ProjectSpec): Promise<any> {
    const sanitized = {
      ...spec,
      requirements: spec?.requirements ?? [],
      taskIdToDisplayIndex: spec?.taskIdToDisplayIndex ?? {},
    }

    const { valid, errors } = validateProjectSpec(sanitized)
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors }

    const dir = await this.ensureProjectsDirExists()

    const project = await this.getProject(sanitized.id)
    if (project) {
      return project
    }

    const target = path.join(dir, `${sanitized.id}.json`)
    await fs.writeFile(target, JSON.stringify(sanitized, null, 2), 'utf8')

    this.projects.push(sanitized)
    await this.__notify()
    return sanitized
  }

  async updateProject(id: string, spec: any): Promise<any> {
    const sanitized = { ...spec }
    if (!Array.isArray(sanitized.requirements)) sanitized.requirements = []
    if (!sanitized.id) sanitized.id = id
    const { valid, errors } = validateProjectSpec(sanitized)
    if (!valid) return { ok: false, error: 'Invalid project spec', details: errors }

    await this.ensureProjectsDirExists()
    const existingPath = this.getProjectConfigPathForId(id)
    const writePath = this.getProjectConfigPathForId(sanitized.id)

    await fs.writeFile(writePath, JSON.stringify(sanitized, null, 2), 'utf8')
    try {
      if (
        (await pathExists(existingPath)) &&
        path.resolve(existingPath) !== path.resolve(writePath)
      ) {
        await fs.unlink(existingPath)
      }
    } catch {}

    this.projects = this.projects.map((p) => (p.id === sanitized.id ? sanitized : p))
    await this.__notify()
    return sanitized
  }

  async deleteProject(id: string): Promise<void> {
    const p = this.getProjectConfigPathForId(id)
    if (await pathExists(p)) {
      await fs.unlink(p)
      this.projects = this.projects.filter((p) => p.id !== id)
      await this.__notify()
    }
  }

  async reorderTask(projectId: string, fromIndex: number, toIndex: number): Promise<{ ok: true }> {
    const project: any = await this.getProject(projectId)
    if (!project) {
      throw new Error(`Project with id: ${projectId} not found`)
    }

    const currentOrder = Object.keys(project.taskIdToDisplayIndex).sort(
      (a, b) => project.taskIdToDisplayIndex[a] - project.taskIdToDisplayIndex[b],
    )

    let newOrder: string[]
    if (fromIndex !== undefined && toIndex !== undefined) {
      if (fromIndex < 0 || fromIndex >= currentOrder.length) throw new Error('Invalid source index')
      if (toIndex < 0 || toIndex > currentOrder.length) throw new Error('Invalid target index')
      newOrder = [...currentOrder]
      const [moved] = newOrder.splice(fromIndex, 1)
      newOrder.splice(toIndex, 0, moved)
    } else {
      throw new Error('Invalid indices for reorder')
    }

    if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
      return { ok: true }
    }

    const newIndex: Record<string, number> = {}
    newOrder.forEach((id, i) => {
      newIndex[id] = i + 1
    })
    project.taskIdToDisplayIndex = newIndex

    const writePath = this.getProjectConfigPathForId(projectId)
    await fs.writeFile(writePath, JSON.stringify(project, null, 2), 'utf8')

    this.projects = this.projects.map((p) => (p.id === project.id ? project : p))

    await this.__notify()
    return { ok: true }
  }
}
