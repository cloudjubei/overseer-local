import { registerFactoryIPC } from './factory-tools/mainOrchestrator'
import { TasksManager } from './tasks/TasksManager';
import { FilesManager } from './files/FilesManager';
import { ProjectsManager } from './projects/ProjectsManager';
import { ChatsManager } from './chat/ChatsManager';
import { NotificationsManager } from './notifications/NotificationsManager';
import { SettingsManager } from './settings/SettingsManager';
import { LiveDataManager } from './live-data/LiveDataManager';

export let tasksManager;
export let filesManager;
export let projectsManager;
export let chatsManager;
export let notificationsManager;
export let settingsManager;
export let liveDataManager;

export async function initManagers(projectRoot, mainWindow) {
  await registerFactoryIPC(mainWindow, projectRoot);
  projectsManager = new ProjectsManager(projectRoot, mainWindow);
  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager);
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager);
  notificationsManager = new NotificationsManager(projectRoot, mainWindow);
  settingsManager = new SettingsManager(projectRoot, mainWindow);
  liveDataManager = new LiveDataManager(projectRoot, mainWindow);
  chatsManager = new ChatsManager(projectRoot, mainWindow, projectsManager, tasksManager, filesManager, settingsManager);

  await projectsManager.init();
  await tasksManager.init();
  await filesManager.init();
  await chatsManager.init();
  await notificationsManager.init();
  await settingsManager.init();
  await liveDataManager.init();
}
export function stopManagers() {
  if (projectsManager) { projectsManager.stopWatching(); }
  if (tasksManager) { tasksManager.stopWatching(); }
  if (filesManager) { filesManager.stopWatching(); }
  if (chatsManager) { chatsManager.stopWatching(); }
  if (notificationsManager) { notificationsManager.stopWatching(); }
  if (settingsManager) { settingsManager.stopWatching(); }
  if (liveDataManager) { liveDataManager.stopWatching(); }
}
