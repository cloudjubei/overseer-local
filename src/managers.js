import { TasksManager } from './tasks/manager';
import { FilesManager } from './files/manager';
import { ProjectsManager } from './projects/manager';
import { ChatsManager } from './chat/manager';
import { NotificationManager } from './notifications/manager';
import { SettingsManager } from './settings/manager';
import { registerFactoryIPC } from './tools/factory/mainOrchestrator.js';

export let tasksManager;
export let filesManager;
export let projectsManager;
export let chatsManager;
export let notificationManager;
export let settingsManager;
export let factory;

export async function initManagers(projectRoot, mainWindow) {
  factory = await registerFactoryIPC(mainWindow, projectRoot);
  projectsManager = new ProjectsManager(projectRoot, mainWindow);
  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager);
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager);
  chatsManager = new ChatsManager(projectRoot, mainWindow, projectsManager, tasksManager, filesManager, factory);
  notificationManager = new NotificationManager(projectRoot, mainWindow);
  settingsManager = new SettingsManager(projectRoot, mainWindow);

  await projectsManager.init();
  await tasksManager.init();
  await filesManager.init();
  await chatsManager.init();
  await notificationManager.init();
  await settingsManager.init();
}
export function stopManagers() {
  if (projectsManager) { projectsManager.stopWatching(); }
  if (tasksManager) { tasksManager.stopWatching(); }
  if (filesManager) { filesManager.stopWatching(); }
  if (chatsManager) { chatsManager.stopWatching(); }
  if (notificationManager) { notificationManager.stopWatching(); }
  if (settingsManager) { settingsManager.stopWatching(); }
}
