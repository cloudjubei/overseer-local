import { TaskManager } from './tasks/manager';
import { FileManager } from './files/manager';
import { ProjectManager } from './projects/manager';
import { ChatManager } from './chat/manager';
import { NotificationManager } from './notifications/manager';

export let taskManager;
export let fileManager;
export let projectManager;
export let chatManager;
export let notificationManager;

export async function initManagers(projectRoot, mainWindow) {
  projectManager = new ProjectManager(projectRoot, mainWindow);
  taskManager = new TaskManager(projectRoot, mainWindow);
  fileManager = new FileManager(projectRoot, mainWindow);
  chatManager = new ChatManager(projectRoot, mainWindow);
  notificationManager = new NotificationManager(projectRoot, mainWindow);

  projectManager.init();
  taskManager.init();
  await fileManager.init();
  await chatManager.init();
  await notificationManager.init();
}
export function stopManagers() {
  if (taskManager) { taskManager.stopWatching(); }
  if (fileManager) { fileManager.stopWatching(); }
  if (projectManager) { projectManager.stopWatching(); }
}