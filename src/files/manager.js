import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import FilesStorage from './storage';
import { projectsManager } from '../managers';

function resolveFilesDir(projectRoot) {
  return projectRoot;
}

export class FilesManager {
  constructor(projectRoot, window, projectsManager) {
    this.window = window;
    this.storages = {};
    this._ipcBound = false;

    this.projectsManager = projectsManager
  }

  async init() {
    await this.__getStorage('main');

    this._registerIpcHandlers();
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = await this.projectsManager.getProject(projectId);
      if (!project){ return }
      const projectRoot = path.resolve(this.projectsManager.projectsDir, project.path);
      const filesDir = resolveFilesDir(projectRoot);
      const storage = new FilesStorage(projectId, filesDir, this.window);
      await storage.init();
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.FILES_LIST] = async ({ projectId }) => (await this.__getStorage(projectId))?.listFiles();
    handlers[IPC_HANDLER_KEYS.FILES_READ] = async ({ projectId, relPath, encoding }) => (await this.__getStorage(projectId))?.readFile(relPath, encoding);
    handlers[IPC_HANDLER_KEYS.FILES_READ_BINARY] = async ({ projectId, relPath }) => (await this.__getStorage(projectId))?.readFileBinary(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_READ_DIRECTORY] = async ({ projectId, relPath }) => (await this.__getStorage(projectId))?.readDirectory(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_WRITE] = async ({ projectId, relPath, content, encoding }) => (await this.__getStorage(projectId))?.writeFile(relPath, content, encoding);
    handlers[IPC_HANDLER_KEYS.FILES_DELETE] = async ({ projectId, relPath }) => (await this.__getStorage(projectId))?.deleteFile(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_RENAME] = async ({ projectId, relPathSource, relPathTarget }) => (await this.__getStorage(projectId))?.renameFile(relPathSource, relPathTarget);
    handlers[IPC_HANDLER_KEYS.FILES_UPLOAD] = async ({ projectId, name, content }) => (await this.__getStorage(projectId))?.uploadFile(name, content);

    for(const handler of Object.keys(handlers)){
      ipcMain.handle(handler, async (event, args) => {
        try {
          return await handlers[handler](args);
        } catch (e) {
          console.error(`${handler} failed`, e);
          return { ok: false, error: String(e?.message || e) };
        }
      });
    }

    this._ipcBound = true;
  }
}
