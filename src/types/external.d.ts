import type { ProjectsService } from 'src/renderer/services/projectsService';
import type { ChatsService } from 'src/renderer/services/chatsService'
import type { FilesService } from 'src/renderer/services/filesService'
import type { TasksService } from 'src/renderer/services/tasksService';
import type { NotificationsService } from 'src/renderer/services/notificationsService';

declare global {
  interface Window {
    tasksService: TasksService
    projectsService: ProjectsService
    filesService: FilesService
    chatsService: ChatsService
    notificationsService: NotificationsService
  }
}
export {}
