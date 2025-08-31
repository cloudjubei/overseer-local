import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import TasksStorage from './storage';
import { projectsManager } from '../managers';

function resolveTasksDir(projectRoot) {
  const candidates = [];
  const root = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
  candidates.push(path.join(root, 'tasks'));
  candidates.push(path.resolve(root, '..', 'tasks'));
  candidates.push(path.resolve(root, '..', '..', 'tasks'));
  candidates.push(path.resolve(process.cwd(), 'tasks'));
  return candidates[0];
}

export class TasksManager {
  constructor(projectRoot, window) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storages = {};
    this._ipcBound = false;
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = projectsManager.index.projectsById[projectId];
      if (!project) {
        throw new Error(`Unknown project ${projectId}`);
      }
      const projectRoot = path.resolve(projectsManager.projectsDir, project.path);
      const tasksDir = resolveTasksDir(projectRoot);
      const storage = new TasksStorage(projectId, tasksDir, this.window);
      await storage.init();
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  async init() {
    this._registerIpcHandlers();
    // Pre-init storages for existing projects
    const projects = await projectsManager.listProjects();
    await Promise.all(projects.map(async (p) => await this.__getStorage(p.id)));
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.TASKS_LIST] = async ({ project }) => (await this.__getStorage(project.id)).listTasks();
    handlers[IPC_HANDLER_KEYS.TASKS_GET] = async ({ project, id }) => (await this.__getStorage(project.id)).getTask(id);
    handlers[IPC_HANDLER_KEYS.TASKS_CREATE] = async ({ project, task }) => (await this.__getStorage(project.id)).createTask(task);
    handlers[IPC_HANDLER_KEYS.TASKS_UPDATE] = async ({ project, taskId, data }) => (await this.__getStorage(project.id)).updateTask(taskId, data);
    handlers[IPC_HANDLER_KEYS.TASKS_DELETE] = async ({ project, taskId }) => (await this.__getStorage(project.id)).deleteTask(taskId);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_GET] = async ({ project, taskId, featureId }) => (await this.__getStorage(project.id)).getFeature(taskId, featureId);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_ADD] = async ({ project, taskId, feature }) => (await this.__getStorage(project.id)).addFeature(taskId, feature);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE] = async ({ project, taskId, featureId, data }) => (await this.__getStorage(project.id)).updateFeature(taskId, featureId, data);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE] = async ({ project, taskId, featureId }) => (await this.__getStorage(project.id)).deleteFeature(taskId, featureId);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER] = async ({ project, taskId, payload }) => (await this.__getStorage(project.id)).reorderFeatures(taskId, payload);

    handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_OUTBOUND] = async ({ project, reference }) => (await this.__getStorage(project.id)).getReferencesOutbound(reference);
    handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_INBOUND] = async ({ project, reference }) => (await this.__getStorage(project.id)).getReferencesInbound(reference);
    handlers[IPC_HANDLER_KEYS.TASKS_REFERENCE_VALIDATE] = async ({ project, reference }) => (await this.__getStorage(project.id)).validateReference(reference);
    handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_VALIDATE] = async ({ project, references }) => (await this.__getStorage(project.id)).validateReferences(references);
    handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_SEARCH] = async ({ project, query, limit }) => (await this.__getStorage(project.id)).searchReferences(query, limit);

    for (const handler of Object.keys(handlers)) {
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
