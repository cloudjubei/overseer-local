import { ElectronAPI } from '@electron-toolkit/preload'
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
import type { GitMonitorService } from 'src/renderer/src/services/gitMonitorService'
import type { StoriesService } from 'src/renderer/src/services/storiesService'
import type { FactoryTestsService } from 'src/renderer/src/services/factoryTestsService'

declare global {
  interface Window {
    electron: ElectronAPI
    dbService: DBService
    factoryAgentRunService: FactoryAgentRunService
    factoryToolsService: FactoryToolsService
    storiesService: StoriesService
    projectsService: ProjectsService
    filesService: FilesService
    chatsService: ChatsService
    notificationsService: NotificationsService
    settingsService: SettingsService
    liveDataService: LiveDataService
    documentIngestionService: DocumentIngestionService
    gitMonitorService: GitMonitorService
    factoryTestsService: FactoryTestsService
  }
}
export {}
