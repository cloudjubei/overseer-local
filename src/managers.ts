import type { BrowserWindow } from 'electron'
import FactoryAgentRunManager from './factory/FactoryAgentRunManager'
import FactoryToolsManager from './factory/FactoryToolsManager'
import FilesManager from './files/FilesManager'
import ProjectsManager from './projects/ProjectsManager'
import StoriesManager from './stories/StoriesManager'
import ChatsManager from './chat/ChatsManager'
import NotificationsManager from './notifications/NotificationsManager'
import SettingsManager from './settings/SettingsManager'
import LiveDataManager from './live-data/LiveDataManager'
import DatabaseManager from './db/DatabaseManager'
import DocumentIngestionManager from './document_ingestion/DocumentIngestionManager'
import GitMonitorManager from './git-monitor/GitMonitorManager'
import BaseManager from './BaseManager'
import FactoryLLMPricingManager from './factory/FactoryLLMPricingManager'
import FactoryTestsManager from './factory/FactoryTestsManager'

export let databaseManager: DatabaseManager | undefined
export let factoryLLMPricingManager: FactoryLLMPricingManager | undefined
export let factoryAgentRunManager: FactoryAgentRunManager | undefined
export let storiesManager: StoriesManager | undefined
export let filesManager: FilesManager | undefined
export let projectsManager: ProjectsManager | undefined
export let chatsManager: ChatsManager | undefined
export let notificationsManager: NotificationsManager | undefined
export let settingsManager: SettingsManager | undefined
export let liveDataManager: LiveDataManager | undefined
export let documentIngestionManager: DocumentIngestionManager | undefined
export let gitMonitorManager: GitMonitorManager | undefined
export let factoryToolsManager: FactoryToolsManager | undefined
export let factoryTestsManager: FactoryTestsManager | undefined

let managers: BaseManager[] = []

export async function initManagers(projectRoot: string, mainWindow: BrowserWindow): Promise<void> {
  databaseManager = new DatabaseManager(projectRoot, mainWindow)
  factoryLLMPricingManager = new FactoryLLMPricingManager(projectRoot, mainWindow)
  factoryAgentRunManager = new FactoryAgentRunManager(
    projectRoot,
    mainWindow,
    factoryLLMPricingManager,
    databaseManager,
  )
  projectsManager = new ProjectsManager(projectRoot, mainWindow)
  storiesManager = new StoriesManager(projectRoot, mainWindow, projectsManager)
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager, databaseManager)
  settingsManager = new SettingsManager(projectRoot, mainWindow)
  notificationsManager = new NotificationsManager(projectRoot, mainWindow, settingsManager)
  liveDataManager = new LiveDataManager(projectRoot, mainWindow, factoryLLMPricingManager)
  chatsManager = new ChatsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    storiesManager,
    filesManager,
    settingsManager,
  )
  documentIngestionManager = new DocumentIngestionManager(
    projectRoot,
    mainWindow,
    databaseManager,
    projectsManager,
    filesManager,
  )
  gitMonitorManager = new GitMonitorManager(projectRoot, mainWindow)
  factoryToolsManager = new FactoryToolsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    settingsManager,
  )
  factoryTestsManager = new FactoryTestsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    filesManager,
  )

  managers = [
    databaseManager,
    factoryLLMPricingManager,
    factoryAgentRunManager,
    projectsManager,
    storiesManager,
    filesManager,
    chatsManager,
    notificationsManager,
    settingsManager,
    liveDataManager,
    documentIngestionManager,
    gitMonitorManager,
    factoryToolsManager,
    factoryTestsManager,
  ]

  for (const manager of managers) {
    await manager.init()
  }
}

export function stopManagers(): void {
  for (const manager of managers) {
    try {
      manager.stopWatching()
    } catch (_) {}
  }
}
