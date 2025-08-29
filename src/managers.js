import { TaskManager } from './tasks/manager';
import { FileManager } from './files/manager';
import { ProjectManager } from './projects/manager';
import { ChatManager } from './chat/manager';

export let taskManager;
export let fileManager;
export let projectManager;
export let chatManager;

export async function initManagers(projectRoot, mainWindow) {
  projectManager = new ProjectManager(projectRoot, mainWindow);
  taskManager = new TaskManager(projectRoot, mainWindow);
  fileManager = new FileManager(projectRoot, mainWindow);
  chatManager = new ChatManager(projectRoot);

  projectManager.init();
  taskManager.init();
  await fileManager.init();
}
