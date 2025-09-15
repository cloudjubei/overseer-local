import type { ProjectsService } from 'src/renderer/services/projectsService'
import type { ChatsService } from 'src/renderer/services/chatsService'
import type { FilesService } from 'src/renderer/services/filesService'
import type { TasksService } from 'src/renderer/services/tasksService'
import type { NotificationsService } from 'src/renderer/services/notificationsService'
import type { SettingsService } from 'src/renderer/services/settingsService'
import type { LiveDataService } from 'src/renderer/services/liveDataService'
import type { FactoryService } from 'src/renderer/services/factoryService'
import type { DBService } from 'src/renderer/services/dbService'
import type { DocumentIngestionService } from 'src/renderer/services/documentIngestionService'
import type { GitMonitorService } from 'src/renderer/services/gitMonitorService'

declare global {
  interface Window {
    dbService: DBService
    factoryService: FactoryService
    tasksService: TasksService
    projectsService: ProjectsService
    filesService: FilesService
    chatsService: ChatsService
    notificationsService: NotificationsService
    settingsService: SettingsService
    liveDataService: LiveDataService
    documentIngestionService: DocumentIngestionService
    gitMonitorService: GitMonitorService
  }
}
export {}
