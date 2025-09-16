import type { BrowserWindow } from 'electron'
import FactoryToolsManager from './factory-tools/FactoryToolsManager'
import TasksManager from './tasks/TasksManager'
import FilesManager from './files/FilesManager'
import ProjectsManager from './projects/ProjectsManager'
import ChatsManager from './chat/ChatsManager'
import NotificationsManager from './notifications/NotificationsManager'
import SettingsManager from './settings/SettingsManager'
import LiveDataManager from './live-data/LiveDataManager'
import DatabaseManager from './db/DatabaseManager'
import DocumentIngestionManager from './document_ingestion/DocumentIngestionManager'
import GitMonitorManager from './git-monitor/GitMonitorManager'

export interface BaseManager {
  init(): Promise<void>
  stopWatching?: () => void | Promise<void>
}

export let dbManager: DatabaseManager | undefined
export let factoryToolsManager: FactoryToolsManager | undefined
export let tasksManager: TasksManager | undefined
export let filesManager: FilesManager | undefined
export let projectsManager: ProjectsManager | undefined
export let chatsManager: ChatsManager | undefined
export let notificationsManager: NotificationsManager | undefined
export let settingsManager: SettingsManager | undefined
export let liveDataManager: LiveDataManager | undefined
export let documentIngestionManager: DocumentIngestionManager | undefined
export let gitMonitorManager: GitMonitorManager | undefined

let managers: BaseManager[] = []

export async function initManagers(projectRoot: string, mainWindow: BrowserWindow): Promise<void> {
  dbManager = new DatabaseManager(projectRoot, mainWindow)
  factoryToolsManager = new FactoryToolsManager(projectRoot, mainWindow, dbManager)
  projectsManager = new ProjectsManager(projectRoot, mainWindow)
  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager)
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager)
  settingsManager = new SettingsManager(projectRoot, mainWindow)
  notificationsManager = new NotificationsManager(projectRoot, mainWindow, settingsManager)
  liveDataManager = new LiveDataManager(projectRoot, mainWindow, factoryToolsManager)
  chatsManager = new ChatsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    tasksManager,
    filesManager,
    settingsManager,
  )
  documentIngestionManager = new DocumentIngestionManager(
    projectRoot,
    mainWindow,
    dbManager,
    projectsManager,
    filesManager,
  )
  gitMonitorManager = new GitMonitorManager(projectRoot, mainWindow)

  managers = [
    dbManager,
    factoryToolsManager,
    projectsManager,
    tasksManager,
    filesManager,
    chatsManager,
    notificationsManager,
    settingsManager,
    liveDataManager,
    documentIngestionManager,
    gitMonitorManager,
  ]

  for (const manager of managers) {
    await manager.init()
  }
}

export function stopManagers(): void {
  for (const manager of managers) {
    try {
      manager.stopWatching?.()
    } catch (_) {}
  }
}
