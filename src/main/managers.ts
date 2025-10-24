import type { BrowserWindow } from 'electron'
import BaseManager from '../logic/BaseManager'
import FactoryAgentRunManager from '../logic/factory/FactoryAgentRunManager'
import FactoryToolsManager from '../logic/factory/FactoryToolsManager'
import FilesManager from '../logic/files/FilesManager'
import ProjectsGroupsManager from '../logic/projectsgroups/ProjectsGroupsManager'
import ProjectsManager from '../logic/projects/ProjectsManager'
import StoriesManager from '../logic/stories/StoriesManager'
import ChatsManager from '../logic/chat/ChatsManager'
import NotificationsManager from '../logic/notifications/NotificationsManager'
import SettingsManager from '../logic/settings/SettingsManager'
import LiveDataManager from '../logic/live-data/LiveDataManager'
import DatabaseManager from '../logic/db/DatabaseManager'
import DocumentIngestionManager from '../logic/document_ingestion/DocumentIngestionManager'
import FactoryCompletionManager from '../logic/factory/FactoryCompletionManager'
import FactoryLLMPricingManager from '../logic/factory/FactoryLLMPricingManager'
import FactoryTestsManager from '../logic/factory/FactoryTestsManager'
import GitCredentialsManager from '../logic/git/GitCredentialsManager'
import GitManager from '../logic/git/GitManager'

export let databaseManager: DatabaseManager | undefined
export let factoryLLMPricingManager: FactoryLLMPricingManager | undefined
export let factoryAgentRunManager: FactoryAgentRunManager | undefined
export let storiesManager: StoriesManager | undefined
export let filesManager: FilesManager | undefined
export let projectsGroupsManager: ProjectsGroupsManager | undefined
export let projectsManager: ProjectsManager | undefined
export let chatsManager: ChatsManager | undefined
export let notificationsManager: NotificationsManager | undefined
export let settingsManager: SettingsManager | undefined
export let liveDataManager: LiveDataManager | undefined
export let documentIngestionManager: DocumentIngestionManager | undefined
export let factoryToolsManager: FactoryToolsManager | undefined
export let factoryCompletionManager: FactoryCompletionManager | undefined
export let factoryTestsManager: FactoryTestsManager | undefined
export let gitCredentialsManager: GitCredentialsManager | undefined
export let gitManager: GitManager | undefined

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
  projectsGroupsManager = new ProjectsGroupsManager(projectRoot, mainWindow)
  projectsManager = new ProjectsManager(projectRoot, mainWindow)
  storiesManager = new StoriesManager(projectRoot, mainWindow, projectsManager)
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager, databaseManager)
  settingsManager = new SettingsManager(projectRoot, mainWindow)
  notificationsManager = new NotificationsManager(projectRoot, mainWindow, settingsManager)
  liveDataManager = new LiveDataManager(projectRoot, mainWindow, factoryLLMPricingManager)
  chatsManager = new ChatsManager(projectRoot, mainWindow)
  documentIngestionManager = new DocumentIngestionManager(
    projectRoot,
    mainWindow,
    databaseManager,
    projectsManager,
    filesManager,
  )
  factoryToolsManager = new FactoryToolsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    settingsManager,
  )
  factoryCompletionManager = new FactoryCompletionManager(
    projectRoot,
    mainWindow,
    chatsManager,
    factoryToolsManager,
  )
  factoryTestsManager = new FactoryTestsManager(projectRoot, mainWindow, projectsManager)
  gitCredentialsManager = new GitCredentialsManager(projectRoot, mainWindow)
  gitManager = new GitManager(projectRoot, mainWindow, projectsManager, gitCredentialsManager)

  managers = [
    databaseManager,
    factoryLLMPricingManager,
    factoryAgentRunManager,
    projectsGroupsManager,
    projectsManager,
    storiesManager,
    filesManager,
    chatsManager,
    notificationsManager,
    settingsManager,
    liveDataManager,
    documentIngestionManager,
    factoryToolsManager,
    factoryCompletionManager,
    factoryTestsManager,
    gitCredentialsManager,
    gitManager,
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
