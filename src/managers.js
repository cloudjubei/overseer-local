import { FactoryToolsManager } from './factory-tools/FactoryToolsManager'
import { TasksManager } from './tasks/TasksManager'
import { FilesManager } from './files/FilesManager'
import { ProjectsManager } from './projects/ProjectsManager'
import { ChatsManager } from './chat/ChatsManager'
import { NotificationsManager } from './notifications/NotificationsManager'
import { SettingsManager } from './settings/SettingsManager'
import { LiveDataManager } from './live-data/LiveDataManager'
import { DatabaseManager } from './db/DatabaseManager'
import DocumentIngestionService from './db/DocumentIngestionService'
import IPC_HANDLER_KEYS from './ipcHandlersKeys'
import { ipcMain } from 'electron'

export let dbManager
export let factoryToolsManager
export let tasksManager
export let filesManager
export let projectsManager
export let chatsManager
export let notificationsManager
export let settingsManager
export let liveDataManager
export let documentIngestionService

export async function initManagers(projectRoot, mainWindow) {
  // Initialize thefactory-db connection first so downstream managers can rely on it if needed
  dbManager = new DatabaseManager(projectRoot, mainWindow)
  await dbManager.init()

  factoryToolsManager = new FactoryToolsManager(projectRoot, mainWindow, dbManager)
  projectsManager = new ProjectsManager(projectRoot, mainWindow)

  // Initialize ingestion service to be used by FilesManager and elsewhere
  const dbClient = dbManager?.getClient?.()
  documentIngestionService = new DocumentIngestionService({
    projectsManager,
    filesManager: undefined, // will be set later if needed
    db: dbClient,
    logger: console,
    dbManager,
  })

  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager)
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager)
  notificationsManager = new NotificationsManager(projectRoot, mainWindow)
  settingsManager = new SettingsManager(projectRoot, mainWindow)
  liveDataManager = new LiveDataManager(projectRoot, mainWindow, factoryToolsManager)
  chatsManager = new ChatsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    tasksManager,
    filesManager,
    settingsManager,
  )

  // Expose DB status IPC
  ipcMain.handle(IPC_HANDLER_KEYS.DB_GET_STATUS, async () => dbManager.getStatus())

  await factoryToolsManager.init()
  await projectsManager.init()
  await tasksManager.init()
  await filesManager.init()
  await chatsManager.init()
  await notificationsManager.init()
  await settingsManager.init()
  await liveDataManager.init()
}
export function stopManagers() {
  if (factoryToolsManager) {
    factoryToolsManager.stopWatching()
  }
  if (projectsManager) {
    projectsManager.stopWatching()
  }
  if (tasksManager) {
    tasksManager.stopWatching()
  }
  if (filesManager) {
    filesManager.stopWatching()
  }
  if (chatsManager) {
    chatsManager.stopWatching()
  }
  if (notificationsManager) {
    notificationsManager.stopWatching()
  }
  if (settingsManager) {
    settingsManager.stopWatching()
  }
  if (liveDataManager) {
    liveDataManager.stopWatching()
  }
  if (dbManager) {
    dbManager.stopWatching()
  }
}
