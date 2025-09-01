import { ipcMain } from 'electron';
import path from 'path';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";
import TasksStorage from './storage';

function resolveTasksDir(projectRoot) {
  return path.join(projectRoot, 'tasks');
}

export class TasksManager {
  constructor(projectRoot, window, projectsManager) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.storages = {};
    this._ipcBound = false;

    this.projectsManager = projectsManager
  }

  async __getStorage(projectId) {
    if (!this.storages[projectId]) {
      const project = await this.projectsManager.getProject(projectId)
      if (!project){ return }
      const projectRoot = path.resolve(this.projectsManager.projectsDir, project.path);
      const tasksDir = resolveTasksDir(projectRoot);
      const storage = new TasksStorage(projectId, tasksDir, this.window);
      await storage.init();
      this.storages[projectId] = storage;
    }
    return this.storages[projectId];
  }

  async init() {
    await this.__getStorage('main');

    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    const handlers = {};
    handlers[IPC_HANDLER_KEYS.TASKS_LIST] = async ({ projectId }) => await this.listTasks(projectId);
    handlers[IPC_HANDLER_KEYS.TASKS_GET] = async ({ projectId, id }) => await this.getTask(projectId, id);
    handlers[IPC_HANDLER_KEYS.TASKS_CREATE] = async ({ projectId, task }) => (await this.createTask(projectId, task));
    handlers[IPC_HANDLER_KEYS.TASKS_UPDATE] = async ({ projectId, taskId, data }) => (await this.__getStorage(projectId))?.updateTask(taskId, data);
    handlers[IPC_HANDLER_KEYS.TASKS_DELETE] = async ({ projectId, taskId }) => (await this.deleteTask(projectId, taskId));
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_GET] = async ({ projectId, taskId, featureId }) => await this.getFeature(projectId, taskId, featureId);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_ADD] = async ({ projectId, taskId, feature }) => (await this.__getStorage(projectId))?.addFeature(taskId, feature);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE] = async ({ projectId, taskId, featureId, data }) => (await this.__getStorage(projectId))?.updateFeature(taskId, featureId, data);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE] = async ({ projectId, taskId, featureId }) => (await this.__getStorage(projectId))?.deleteFeature(taskId, featureId);
    handlers[IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER] = async ({ projectId, taskId, payload }) => (await this.__getStorage(projectId))?.reorderFeatures(taskId, payload);

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

  async listTasks(projectId)
  {
    const s = await this.__getStorage(projectId)
    return await s?.listTasks()
  }
  async getTask(projectId, id)
  {
    const s = await this.__getStorage(projectId)
    return await s?.getTask(id)
  }

  async createTask(projectId, taskData)
  {
    const project = await this.projectsManager.getProject(projectId)
    if (!project) { return { ok: false, error: "project couldn't be found"} }

    const storage = await this.__getStorage(projectId)
    const newTask = await storage?.createTask(taskData)
    if (!newTask){ return { ok: false, error: "task couldn't be created" } }

    const newProject = {...project}
    newProject.taskIdToDisplayIndex[newTask.id] = Object.keys(newProject.taskIdToDisplayIndex).length + 1
    await this.projectsManager.updateProject(project.id, newProject)
    return { ok: true }
  }

  async deleteTask(projectId, taskId)
  {
    const project = this.projectsManager.getProject(projectId)
    if (!project) { return { ok: false, error: "project couldn't be found"} }

    const storage = await this.__getStorage(project.id)
    await storage?.deleteTask(taskId)
    
    const newProject = {...project}
    const index = newProject.taskIdToDisplayIndex[task.id]
    delete newProject.taskIdToDisplayIndex[task.id]
    for(const key of Object.keys(newProject.taskIdToDisplayIndex)){
      if (newProject.taskIdToDisplayIndex[key] > index){
        newProject.taskIdToDisplayIndex[key] = newProject.taskIdToDisplayIndex[key] - 1
      }
    }
    await this.projectsManager.updateProject(project.id, newProject)
    return { ok: true }
  }
  async getFeature(projectId, taskId, featureId)
  {
    const s = await this.__getStorage(projectId)
    return await s?.getFeature(taskId, featureId)
  }
}
