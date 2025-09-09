import { registerFactoryIPC } from './tools/factory/mainOrchestrator'
import { TasksManager } from './tasks/TasksManager';
import { FilesManager } from './files/FilesManager';
import { ProjectsManager } from './projects/ProjectsManager';
import { ChatsManager } from './chat/ChatsManager';
import { NotificationsManager } from './notifications/NotificationsManager';
import { SettingsManager } from './settings/SettingsManager';
import { LiveDataManager } from './live-data/LiveDataManager';
import { GitMonitorService } from './main/services/git-monitor/GitMonitorService';
import { GitOperationsManager } from './main/services/git-ops/GitOperationsManager';

export let tasksManager;
export let filesManager;
export let projectsManager;
export let chatsManager;
export let notificationsManager;
export let settingsManager;
export let liveDataManager;
export let gitMonitorService;
export let gitOperationsManager;

export async function initManagers(projectRoot, mainWindow) {
  await registerFactoryIPC(mainWindow, projectRoot);
  projectsManager = new ProjectsManager(projectRoot, mainWindow);
  tasksManager = new TasksManager(projectRoot, mainWindow, projectsManager);
  filesManager = new FilesManager(projectRoot, mainWindow, projectsManager);
  chatsManager = new ChatsManager(projectRoot, mainWindow, projectsManager, tasksManager, filesManager);
  notificationsManager = new NotificationsManager(projectRoot, mainWindow);
  settingsManager = new SettingsManager(projectRoot, mainWindow);
  liveDataManager = new LiveDataManager(projectRoot, mainWindow);
  gitOperationsManager = new GitOperationsManager(projectRoot, mainWindow, projectsManager);

  await projectsManager.init();
  await tasksManager.init();
  await filesManager.init();
  await chatsManager.init();
  await notificationsManager.init();
  await settingsManager.init();
  await liveDataManager.init();
  await gitOperationsManager.init();

  // Initialize Git monitoring service (main process)
  try {
    gitMonitorService = new GitMonitorService({
      repoPath: projectRoot,
      intervalMs: 60_000,
      fetchOnStart: true,
    });

    // Optional: wire logs to console for now; in future route to UI/notifications
    gitMonitorService.on('branchesUpdated', (changes) => {
      // eslint-disable-next-line no-console
      console.log('[GitMonitor] Branches updated:', changes.map(c => `${c.branch}: ${c.oldSha?.slice(0,7)||'none'} -> ${c.newSha.slice(0,7)} (${c.commits.length} commits)`));
    });
    gitMonitorService.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[GitMonitor] Error:', err.message);
    });

    await gitMonitorService.start();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[GitMonitor] Failed to start:', e?.message || e);
  }
}
export function stopManagers() {
  if (projectsManager) { projectsManager.stopWatching(); }
  if (tasksManager) { tasksManager.stopWatching(); }
  if (filesManager) { filesManager.stopWatching(); }
  if (chatsManager) { chatsManager.stopWatching(); }
  if (notificationsManager) { notificationsManager.stopWatching(); }
  if (settingsManager) { settingsManager.stopWatching(); }
  if (liveDataManager) { liveDataManager.stopWatching(); }
  if (gitMonitorService) { gitMonitorService.stop(); }
}
