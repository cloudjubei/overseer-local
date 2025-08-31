import { TaskManager } from './tasks/manager';
import { FilesManager } from './files/manager';
import { ProjectsManager } from './projects/manager';
import { ChatsManager } from './chat/manager';
import { NotificationManager } from './notifications/manager';

export let taskManager;
export let filesManager;
export let projectsManager;
export let chatsManager;
export let notificationManager;

export async function initManagers(projectRoot, mainWindow) {
  projectsManager = new ProjectsManager(projectRoot, mainWindow);
  taskManager = new TaskManager(projectRoot, mainWindow);
  filesManager = new FilesManager(projectRoot, mainWindow);
  chatsManager = new ChatsManager(projectRoot, mainWindow);
  notificationManager = new NotificationManager(projectRoot, mainWindow);

  await projectsManager.init();
  await taskManager.init();
  await filesManager.init();
  await chatsManager.init();
  await notificationManager.init();
}
export function stopManagers() {
  if (projectsManager) { projectsManager.stopWatching(); }
  if (taskManager) { taskManager.stopWatching(); }
  if (filesManager) { filesManager.stopWatching(); }
  if (chatsManager) { chatsManager.stopWatching(); }
  if (notificationManager) { notificationManager.stopWatching(); }
}