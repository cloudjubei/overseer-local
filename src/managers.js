import { TasksManager } from './tasks/manager';
import { FilesManager } from './files/manager';
import { ProjectsManager } from './projects/manager';
import { ChatsManager } from './chat/manager';
import { NotificationManager } from './notifications/manager';
import { SettingsManager } from './settings/manager';
import { registerFactoryIPC } from './tools/factory/mainOrchestrator'
import { LiveDataService } from './live-data/liveDataService';

export let tasksManager;
export let filesManager;
export let projectsManager;
export let chatsManager;
export let notificationManager;
export let settingsManager;
export let liveDataService;

export async function initManagers(projectRoot, mainWindow) {
  await registerFactoryIPC(mainWindow, projectRoot);
  projectsManager = new ProjectsManager(projectRoot, mainWindow);
  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager);
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager);
  chatsManager = new ChatsManager(projectRoot, mainWindow, projectsManager, tasksManager, filesManager);
  notificationManager = new NotificationManager(projectRoot, mainWindow);
  settingsManager = new SettingsManager(projectRoot, mainWindow);
  liveDataService = new LiveDataService(projectRoot, mainWindow);

  await projectsManager.init();
  await tasksManager.init();
  await filesManager.init();
  await chatsManager.init();
  await notificationManager.init();
  await settingsManager.init();
  await liveDataService.init();
}
export function stopManagers() {
  if (projectsManager) { projectsManager.stopWatching(); }
  if (tasksManager) { tasksManager.stopWatching(); }
  if (filesManager) { filesManager.stopWatching(); }
  if (chatsManager) { chatsManager.stopWatching(); }
  if (notificationManager) { notificationManager.stopWatching(); }
  if (settingsManager) { settingsManager.stopWatching(); }
  if (liveDataService) { liveDataService.stopWatching(); }
}
