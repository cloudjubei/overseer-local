import type { ProjectsService } from 'src/renderer/services/projectsService'
import type { ChatsService } from 'src/renderer/services/chatsService'
import type { FilesService } from 'src/renderer/services/filesService'
import type { NotificationsService } from 'src/renderer/services/notificationsService'
import type { SettingsService } from 'src/renderer/services/settingsService'
import type { LiveDataService } from 'src/renderer/services/liveDataService'
import type { FactoryAgentRunService } from 'src/renderer/services/factoryAgentRunService'
import type { FactoryToolsService } from 'src/renderer/services/factoryToolsService'
import type { DBService } from 'src/renderer/services/dbService'
import type { DocumentIngestionService } from 'src/renderer/services/documentIngestionService'
import type { GitMonitorService } from 'src/renderer/services/gitMonitorService'
import type { StoriesService } from 'src/renderer/services/storiesService'
import type { FactoryTestsService } from 'src/renderer/services/FactoryTestsService'

declare global {
  interface Window {
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
