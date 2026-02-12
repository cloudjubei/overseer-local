import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectsGroupsService } from '@renderer/services/projectsGroupsService'
import type { ProjectsService } from '@renderer/services/projectsService'
import type { ChatsService } from '@renderer/services/chatsService'
import type { FilesService } from '@renderer/services/filesService'
import type { NotificationsService } from '@renderer/services/notificationsService'
import type { SettingsService } from '@renderer/services/settingsService'
import type { LiveDataService } from '@renderer/services/liveDataService'
import type { FactoryAgentRunService } from '@renderer/services/factoryAgentRunService'
import type { FactoryToolsService } from '@renderer/services/factoryToolsService'
import type { DBService } from '@renderer/services/dbService'
import type { DocumentIngestionService } from '@renderer/services/documentIngestionService'
import type { StoriesService } from '@renderer/services/storiesService'
import type { FactoryTestsService } from '@renderer/services/factoryTestsService'
import type { CompletionService } from '@renderer/services/completionService'
import type { GitService } from '@renderer/services/gitService'
import type { GitCredentialsService } from '@renderer/services/gitCredentialsService'
import type { LLMConfigsService } from '@renderer/services/llmConfigsService'

declare global {
  interface Window {
    electron: ElectronAPI
    dbService: DBService
    factoryAgentRunService: FactoryAgentRunService
    factoryToolsService: FactoryToolsService
    storiesService: StoriesService
    projectsService: ProjectsService
    projectsGroupsService: ProjectsGroupsService
    filesService: FilesService
    chatsService: ChatsService
    completionService: CompletionService
    notificationsService: NotificationsService
    settingsService: SettingsService
    liveDataService: LiveDataService
    documentIngestionService: DocumentIngestionService
    factoryTestsService: FactoryTestsService
    gitService: GitService
    gitCredentialsService: GitCredentialsService
    llmConfigsService: LLMConfigsService
  }
}
export {}
