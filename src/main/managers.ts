import type { BrowserWindow } from 'electron'
import BaseManager from '../logic/BaseManager'
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
import FactoryLLMCostsManager from '../logic/factory/FactoryLLMCostsManager'
import FactoryTestsManager from '../logic/factory/FactoryTestsManager'
import CodeIntelManager from '../logic/code_intel/CodeIntelManager'
import LLMConfigsManager from '../logic/llm/LLMConfigsManager'
import GitCredentialsManager from '../logic/git/GitCredentialsManager'
import GitManager from '../logic/git/GitManager'
import DiagnosticsManager from '../logic/diagnostics/DiagnosticsManager'

export let databaseManager: DatabaseManager | undefined
export let factoryLLMCostsManager: FactoryLLMCostsManager | undefined
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
export let codeIntelManager: CodeIntelManager | undefined
export let llmConfigsManager: LLMConfigsManager | undefined
export let gitCredentialsManager: GitCredentialsManager | undefined
export let gitManager: GitManager | undefined
export let diagnosticsManager: DiagnosticsManager | undefined

let managers: BaseManager[] = []

export async function initManagers(projectRoot: string, mainWindow: BrowserWindow): Promise<void> {
  databaseManager = new DatabaseManager(projectRoot, mainWindow)
  projectsGroupsManager = new ProjectsGroupsManager(projectRoot, mainWindow)
  projectsManager = new ProjectsManager(projectRoot, mainWindow)
  storiesManager = new StoriesManager(projectRoot, mainWindow, projectsManager)
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager, databaseManager)
  settingsManager = new SettingsManager(projectRoot, mainWindow)
  notificationsManager = new NotificationsManager(
    projectRoot,
    mainWindow,
    settingsManager,
    projectsManager,
  )
  chatsManager = new ChatsManager(projectRoot, mainWindow)
  documentIngestionManager = new DocumentIngestionManager(
    projectRoot,
    mainWindow,
    databaseManager,
    projectsManager,
    filesManager,
  )
  llmConfigsManager = new LLMConfigsManager(projectRoot, mainWindow)
  gitCredentialsManager = new GitCredentialsManager(projectRoot, mainWindow)
  gitManager = new GitManager(projectRoot, mainWindow, projectsManager, gitCredentialsManager)
  diagnosticsManager = new DiagnosticsManager(projectRoot, mainWindow)

  factoryLLMCostsManager = new FactoryLLMCostsManager(projectRoot, mainWindow, databaseManager)
  liveDataManager = new LiveDataManager(projectRoot, mainWindow, factoryLLMCostsManager)
  factoryTestsManager = new FactoryTestsManager(projectRoot, mainWindow, projectsManager)
  codeIntelManager = new CodeIntelManager(projectRoot, mainWindow)
  factoryToolsManager = new FactoryToolsManager(
    projectRoot,
    mainWindow,
    projectsManager,
    storiesManager,
    settingsManager,
    databaseManager,
    gitManager,
    gitCredentialsManager,
  )
  factoryCompletionManager = new FactoryCompletionManager(
    projectRoot,
    mainWindow,
    chatsManager,
    factoryToolsManager,
    factoryLLMCostsManager,
    projectsManager,
  )

  managers = [
    databaseManager,
    projectsGroupsManager,
    projectsManager,
    storiesManager,
    filesManager,
    chatsManager,
    notificationsManager,
    settingsManager,
    documentIngestionManager,
    gitCredentialsManager,
    gitManager,
    factoryLLMCostsManager,
    liveDataManager,
    factoryToolsManager,
    factoryCompletionManager,
    factoryTestsManager,
    codeIntelManager,
    llmConfigsManager,
    diagnosticsManager,
  ]

  for (const manager of managers) {
    await manager.init()
  }
}

export function stopManagers(): void {
  for (const manager of managers) {
    try {
      manager.cleanup()
    } catch (_) {}
  }
}
