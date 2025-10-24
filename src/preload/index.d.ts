import { ElectronAPI } from '@electron-toolkit/preload'
import type { ProjectsGroupsService } from 'src/renderer/src/services/projectsGroupsService'
import type { ProjectsService } from 'src/renderer/src/services/projectsService'
import type { ChatsService } from 'src/renderer/src/services/chatsService'
import type { FilesService } from 'src/renderer/src/services/filesService'
import type { NotificationsService } from 'src/renderer/src/services/notificationsService'
import type { SettingsService } from 'src/renderer/src/services/settingsService'
import type { LiveDataService } from 'src/renderer/src/services/liveDataService'
import type { FactoryAgentRunService } from 'src/renderer/src/services/factoryAgentRunService'
import type { FactoryToolsService } from 'src/renderer/src/services/factoryToolsService'
import type { DBService } from 'src/renderer/src/services/dbService'
import type { DocumentIngestionService } from 'src/renderer/src/services/documentIngestionService'
import type { StoriesService } from 'src/renderer/src/services/storiesService'
import type { FactoryTestsService } from 'src/renderer/src/services/factoryTestsService'
import type { CompletionService } from '@renderer/services/completionService'
import type { GitService } from 'src/renderer/src/services/gitService'

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
  }
}
export {}
