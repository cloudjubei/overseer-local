import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { validateTask } from './validator';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys";

function isNumericDir(name) {
  return /^\d+$/.test(name);
}

async function pathExists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

export default class TasksStorage {
  constructor(projectId, tasksDir, window) {
    this.projectId = projectId;
    this.tasksDir = tasksDir;
    this.window = window;
    this.index = {
      tasksDir: this.tasksDir,
      updatedAt: null,
      tasksById: {},
      featuresById: {},
      outboundByFeatureId: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 }
    };
    this.watcher = null;
  }

  async init() {
    await this.buildIndex();
    await this.startWatcher();
  }

  getIndex() {
    return this.index;
  }

  async startWatcher() {
    if (this.watcher) this.stopWatching();
    if (!(await pathExists(this.tasksDir))) return;
    this.watcher = chokidar.watch(path.join(this.tasksDir, '*/task.json'), {
      ignored: /(^|[\/\\])\../,
      persistent: true,
      ignoreInitial: true,
    });
    this.watcher
      .on('add', (p) => this.rebuildAndNotify(`File added: ${p}`))
      .on('change', (p) => this.rebuildAndNotify(`File changed: ${p}`))
      .on('unlink', (p) => this.rebuildAndNotify(`File removed: ${p}`));
  }

  stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  async rebuildAndNotify(msg) {
    if (msg) console.log(msg);
    await this.buildIndex();
    if (this.window) {
      this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE, { projectId: this.projectId });
    }
  }

  async buildIndex() {
    const startTime = Date.now();
    const newIndex = {
      tasksDir: this.tasksDir,
      updatedAt: new Date().toISOString(),
      tasksById: {},
      featuresById: {},
      outboundByFeatureId: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 }
    };

    try {
      if (!await pathExists(this.tasksDir)) {
        newIndex.errors.push({ file: this.tasksDir, errors: ['Tasks directory not found'] });
      } else {
        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const tasks = [];
        for (const dirent of taskDirs) {
          if (dirent.isDirectory() && isNumericDir(dirent.name)) {
            const taskId = dirent.name;
            const taskFilePath = path.join(this.tasksDir, taskId, 'task.json');
            try {
              const content = await fs.readFile(taskFilePath, 'utf-8');
              const task = JSON.parse(content);
              if (task.id !== taskId) {
                newIndex.errors.push({ file: taskFilePath, errors: [`Task ID mismatch: file has ${task.id}, dir is ${taskId}`] });
                continue;
              }
              const { valid, errors } = validateTask(task);
              if (!valid) {
                newIndex.errors.push({ file: taskFilePath, errors });
                continue;
              }
              newIndex.tasksById[taskId] = task;
              task.features.forEach(feature => {
                newIndex.featuresById[feature.id] = feature;
              });
              tasks.push(task);
            } catch (err) {
              newIndex.errors.push({ file: taskFilePath, errors: [err.message] });
            }
          }
        }
        // Compute outbound dependencies
        const outbound = {};
        for (const task of tasks) {
          for (const feature of task.features) {
            for (const dep of feature.dependencies || []) {
              if (!outbound[dep]) outbound[dep] = [];
              outbound[dep].push(feature.id);
            }
          }
        }
        newIndex.outboundByFeatureId = outbound;
      }
    } catch (err) {
      newIndex.errors.push({ file: this.tasksDir, errors: [err.message] });
    }

    this.index = newIndex;
    this.index.metrics.lastScanMs = Date.now() - startTime;
    this.index.metrics.lastScanCount = Object.keys(newIndex.tasksById).length;
  }

  async listTasks() {
    return Object.values(this.index.tasksById);
  }

  async getTask(id) {
    return this.index.tasksById[id];
  }

  async createTask(task) {
    const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
    const existingIds = taskDirs
      .filter(d => d.isDirectory() && isNumericDir(d.name))
      .map(d => parseInt(d.name, 10));
    const nextIdNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const nextId = String(nextIdNum);

    const newTaskDir = path.join(this.tasksDir, nextId);
    await fs.mkdir(newTaskDir, { recursive: true });

    const newTask = {
      id: nextId,
      status: task.status || '-',
      title: task.title || '',
      description: task.description || '',
      features: (task.features || []).map((f, index) => ({
        ...f,
        id: `${nextId}.${index + 1}`,
        status: f.status || '-'
      })),
      rejection: task.rejection
    };

    const { valid, errors } = validateTask(newTask);
    if (!valid) {
      await fs.rm(newTaskDir, { recursive: true, force: true });
      throw new Error(`Invalid new task: ${errors.join(', ')}`);
    }

    const taskPath = path.join(newTaskDir, 'task.json');
    await fs.writeFile(taskPath, JSON.stringify(newTask, null, 2), 'utf-8');
    await this.rebuildAndNotify(`New task ${nextId} added.`);
    return { ok: true, id: nextId };
  }

  async updateTask(taskId, data) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json');
    let taskData;
    try {
      const raw = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
    }

    const { id, features, ...patchable } = data || {};
    const next = { ...taskData, ...patchable };

    const { valid, errors } = validateTask(next);
    if (!valid) {
      throw new Error(`Invalid task update for ${taskId}: ${errors.join(', ')}`);
    }

    await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8');
    await this.rebuildAndNotify(`Task ${taskId} updated`);
    return { ok: true };
  }

  async deleteTask(taskId) {
    const taskDirPath = path.join(this.tasksDir, taskId);
    const deletedTask = this.index.tasksById[taskId];
    const deletedFeatureIds = new Set(deletedTask ? deletedTask.features.map(f => f.id) : []);

    try {
      await fs.rm(taskDirPath, { recursive: true, force: true });
    } catch (e) {
      throw new Error(`Could not delete task directory for task ${taskId}: ${e.message}`);
    }

    if (deletedFeatureIds.size > 0) {
      const tasksToUpdate = {};
      for (const currentTaskId of Object.keys(this.index.tasksById)) {
        const currentTaskData = this.index.tasksById[currentTaskId];
        let taskModified = false;
        const updatedFeatures = currentTaskData.features.map(feature => {
          if (!feature.dependencies || feature.dependencies.length === 0) return feature;
          const filtered = feature.dependencies.filter(dep => !deletedFeatureIds.has(dep));
          if (filtered.length !== feature.dependencies.length) {
            taskModified = true;
            return { ...feature, dependencies: filtered };
          }
          return feature;
        });
        if (taskModified) {
          tasksToUpdate[currentTaskId] = { ...currentTaskData, features: updatedFeatures };
        }
      }

      await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
        const filePath = path.join(this.tasksDir, id, 'task.json');
        return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      }));
    }

    await this.rebuildAndNotify(`Task ${taskId} deleted, dependencies updated.`);
    return { ok: true };
  }

  async getFeature(taskId, featureId) {
    const task = this.index.tasksById[taskId];
    if (!task) return null;
    return task.features.find(f => f.id === featureId) || null;
  }

  async addFeature(taskId, feature) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json');
    let taskData;
    try {
      const rawData = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(rawData);
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
    }

    const nextFeatureNum = taskData.features.length + 1;
    const newId = `${taskId}.${nextFeatureNum}`;
    const newFeature = {
      id: newId,
      status: feature.status || '-',
      title: feature.title || '',
      description: feature.description || '',
      plan: feature.plan || '',
      context: feature.context || [],
      acceptance: feature.acceptance || [],
      dependencies: feature.dependencies || [],
      rejection: feature.rejection
    };
    taskData.features.push(newFeature);
    if (!taskData.featureIdToDisplayIndex) taskData.featureIdToDisplayIndex = {};
    taskData.featureIdToDisplayIndex[newId] = nextFeatureNum;

    const { valid, errors } = validateTask(taskData);
    if (!valid) {
      throw new Error(`Invalid task after adding feature: ${errors.join(', ')}`);
    }

    await fs.writeFile(taskPath, JSON.stringify(taskData, null, 2), 'utf-8');
    await this.rebuildAndNotify(`Feature added to task ${taskId}.`);
    return { ok: true, id: newId };
  }

  async updateFeature(taskId, featureId, data) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json');
    let taskData;
    try {
      const raw = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
    }

    const { id, ...patchable } = data || {};
    const features = taskData.features.map(f => f.id === featureId ? { ...f, ...patchable } : f);
    const next = { ...taskData, features };

    const { valid, errors } = validateTask(next);
    if (!valid) {
      throw new Error(`Invalid task update for ${taskId}: ${errors.join(', ')}`);
    }

    await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8');
    await this.rebuildAndNotify(`Feature ${featureId} updated in task ${taskId}`);
    return { ok: true };
  }

  async deleteFeature(taskId, featureId) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json');
    let taskData;
    try {
      const rawData = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(rawData);
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
    }

    const featureIndex = taskData.features.findIndex(f => f.id === featureId);
    if (featureIndex === -1) {
      throw new Error(`Feature ${featureId} not found in task ${taskId}`);
    }
    taskData.features.splice(featureIndex, 1);

    // Rebuild featureIdToDisplayIndex
    if (taskData.featureIdToDisplayIndex) {
      const sortedFeatures = [...taskData.features].sort((a, b) => taskData.featureIdToDisplayIndex[a.id] - taskData.featureIdToDisplayIndex[b.id]);
      const newIndex = {};
      sortedFeatures.forEach((f, i) => {
        newIndex[f.id] = i + 1;
      });
      taskData.featureIdToDisplayIndex = newIndex;
    }

    // Cleanup dependencies across all tasks
    const deletedFeatureIds = new Set([featureId]);
    const tasksToUpdate = {};
    for (const currentTaskId of Object.keys(this.index.tasksById)) {
      const currentTaskData = this.index.tasksById[currentTaskId];
      let taskModified = false;
      const updatedFeatures = currentTaskData.features.map(feature => {
        if (!feature.dependencies || feature.dependencies.length === 0) return feature;
        const filtered = feature.dependencies.filter(dep => !deletedFeatureIds.has(dep));
        if (filtered.length !== feature.dependencies.length) {
          taskModified = true;
          return { ...feature, dependencies: filtered };
        }
        return feature;
      });
      if (taskModified) {
        tasksToUpdate[currentTaskId] = { ...currentTaskData, features: updatedFeatures };
      }
    }
    tasksToUpdate[taskId] = taskData; // Include the updated task itself

    await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
      const filePath = path.join(this.tasksDir, id, 'task.json');
      return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    }));

    await this.rebuildAndNotify(`Feature ${featureId} deleted from task ${taskId}, dependencies updated.`);
    return { ok: true };
  }

  async reorderFeatures(taskId, payload) {
    const taskPath = path.join(this.tasksDir, taskId, 'task.json');
    let taskData;
    try {
      const rawData = await fs.readFile(taskPath, 'utf-8');
      taskData = JSON.parse(rawData);
    } catch (e) {
      throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
    }

    if (!taskData.featureIdToDisplayIndex) taskData.featureIdToDisplayIndex = {};
    const currentOrder = taskData.features.map(f => f.id).sort((a, b) => taskData.featureIdToDisplayIndex[a] - taskData.featureIdToDisplayIndex[b]);

    let newOrder;
    if (payload.fromIndex !== undefined && payload.toIndex !== undefined) {
      const fromIndex = payload.fromIndex;
      const toIndex = payload.toIndex;
      if (fromIndex < 0 || fromIndex >= currentOrder.length) throw new Error('Invalid source index');
      if (toIndex < 0 || toIndex > currentOrder.length) throw new Error('Invalid target index');
      newOrder = [...currentOrder];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);
    } else {
      throw new Error('Invalid payload for reorder');
    }

    if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
      return { ok: true };
    }

    const newIndex = {};
    newOrder.forEach((id, i) => {
      newIndex[id] = i + 1;
    });
    taskData.featureIdToDisplayIndex = newIndex;

    await fs.writeFile(taskPath, JSON.stringify(taskData, null, 2), 'utf-8');
    await this.rebuildAndNotify(`Features reordered for task ${taskId}.`);
    return { ok: true };
  }

  async getReferencesOutbound(reference) {
    return this.index.outboundByFeatureId[reference] || [];
  }

  async getReferencesInbound(reference) {
    const feature = this.index.featuresById[reference];
    if (!feature) return [];
    return feature.dependencies || [];
  }

  async validateReference(reference) {
    if (this.index.tasksById[reference]) return { valid: true, type: 'task' };
    if (this.index.featuresById[reference]) return { valid: true, type: 'feature' };
    return { valid: false, reason: 'Not found' };
  }

  async validateReferences(references) {
    const results = {};
    for (const ref of references) {
      results[ref] = await this.validateReference(ref);
    }
    return results;
  }

  async searchReferences(query, limit = 10) {
    const results = [];
    Object.entries(this.index.tasksById).forEach(([id, task]) => {
      if (id.includes(query) || task.title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: 'task', id, title: task.title });
      }
    });
    Object.entries(this.index.featuresById).forEach(([id, feature]) => {
      if (id.includes(query) || feature.title.toLowerCase().includes(query.toLowerCase())) {
        results.push({ type: 'feature', id, title: feature.title });
      }
    });
    return results.slice(0, limit);
  }
}
