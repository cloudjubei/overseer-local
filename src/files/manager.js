import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import FilesStorage from './storage';
import { projectsManager } from '../managers';

function resolveFilesDir(projectRoot) {
  return projectRoot;
}

export class FilesManager {
  constructor(projectRoot, window, options = {}) {
    this.window = window;
    this.storages = {};
    this._ipcBound = false;
  }

  async init() {
    this._registerIpcHandlers();
    // Pre-init storages for existing projects
    const projects = await projectsManager.listProjects();
    await Promise.all(projects.map(async (p) => await this.__getStorage(p.id)));
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = projectsManager.index.projectsById[projectId];
      if (!project) {
        throw new Error(`Unknown project ${projectId}`);
      }
      const projectRoot = path.resolve(projectsManager.projectsDir, project.path);
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
    handlers[IPC_HANDLER_KEYS.FILES_LIST] = async ({ project }) => (await this.__getStorage(project.id)).listFiles();
    handlers[IPC_HANDLER_KEYS.FILES_READ] = async ({ project, relPath, encoding }) => (await this.__getStorage(project.id)).readFile(relPath, encoding);
    handlers[IPC_HANDLER_KEYS.FILES_READ_BINARY] = async ({ project, relPath }) => (await this.__getStorage(project.id)).readFileBinary(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_READ_DIRECTORY] = async ({ project, relPath }) => (await this.__getStorage(project.id)).readDirectory(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_WRITE] = async ({ project, relPath, content, encoding }) => (await this.__getStorage(project.id)).writeFile(relPath, content, encoding);
    handlers[IPC_HANDLER_KEYS.FILES_DELETE] = async ({ project, relPath }) => (await this.__getStorage(project.id)).deleteFile(relPath);
    handlers[IPC_HANDLER_KEYS.FILES_RENAME] = async ({ project, relPathSource, relPathTarget }) => (await this.__getStorage(project.id)).renameFile(relPathSource, relPathTarget);
    handlers[IPC_HANDLER_KEYS.FILES_UPLOAD] = async ({ project, name, content }) => (await this.__getStorage(project.id)).uploadFile(name, content);

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
