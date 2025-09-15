import { FactoryToolsManager } from './factory-tools/FactoryToolsManager'
import { TasksManager } from './tasks/TasksManager'
import { FilesManager } from './files/FilesManager'
import { ProjectsManager } from './projects/ProjectsManager'
import { ChatsManager } from './chat/ChatsManager'
import { NotificationsManager } from './notifications/NotificationsManager'
import { SettingsManager } from './settings/SettingsManager'
import { LiveDataManager } from './live-data/LiveDataManager'
import { DatabaseManager } from './db/DatabaseManager'
import { DocumentIngestionManager } from './document_ingestion/DocumentIngestionManager'

export let dbManager
export let factoryToolsManager
export let tasksManager
export let filesManager
export let projectsManager
export let chatsManager
export let notificationsManager
export let settingsManager
export let liveDataManager
export let documentIngestionManager

export async function initManagers(projectRoot, mainWindow) {
  dbManager = new DatabaseManager(projectRoot, mainWindow)
  factoryToolsManager = new FactoryToolsManager(projectRoot, mainWindow, dbManager)
  projectsManager = new ProjectsManager(projectRoot, mainWindow)
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
  documentIngestionManager = new DocumentIngestionManager(
    projectRoot,
    mainWindow,
    dbManager,
    projectsManager,
    filesManager,
  )

  await dbManager.init()
  await factoryToolsManager.init()
  await projectsManager.init()
  await tasksManager.init()
  await filesManager.init()
  await chatsManager.init()
  await notificationsManager.init()
  await settingsManager.init()
  await liveDataManager.init()
  await documentIngestionManager.init()
}
export function stopManagers() {
  if (dbManager) {
    dbManager.stopWatching()
  }
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
  if (documentIngestionManager) {
    documentIngestionManager.stopWatching()
  }
}
