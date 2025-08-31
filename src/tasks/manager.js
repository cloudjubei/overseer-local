import fs from 'fs/promises'
import path from 'path';
import chokidar from 'chokidar';
import { ipcMain } from 'electron';
import { validateTask } from './validator';
import IPC_HANDLER_KEYS from "../ipcHandlersKeys"
import { randomUUID } from 'crypto';

function isNumericDir(name) {
    return /^\d+$/.test(name)
}

async function pathExists(p) {
    try { await fs.stat(p); return true } catch { return false }
}

function resolveTasksDir(projectRoot) {
    const candidates = []
    const root = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot)
    candidates.push(path.join(root, 'tasks'))
    candidates.push(path.resolve(root, '..', 'tasks'))
    candidates.push(path.resolve(root, '..', '..', 'tasks'))
    candidates.push(path.resolve(process.cwd(), 'tasks'))
    return candidates[0]
}

export class TaskManager {
    constructor(projectRoot, window) {
        this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
        this.tasksDir = resolveTasksDir(this.projectRoot);
        this.initialTasksDir = this.tasksDir; // Will be corrected in init
        this.index = {
            root: this.projectRoot,
            tasksDir: this.tasksDir,
            updatedAt: null,
            tasksById: {},
            featuresByKey: {},
            errors: [],
            metrics: { lastScanMs: 0, lastScanCount: 0 }
        };
        this.watcher = null;
        this.window = window;
        this._ipcBound = false;
    }

    getIndex() {
        return this.index;
    }

    async init() {
        const candidates = [
            path.join(this.projectRoot, 'tasks'),
            path.resolve(this.projectRoot, '..', 'tasks'),
            path.resolve(this.projectRoot, '..', '..', 'tasks'),
            path.resolve(process.cwd(), 'tasks'),
        ]
        for (const c of candidates) {
            if (await pathExists(c)) {
                this.tasksDir = c
                this.index.tasksDir = c
                this.initialTasksDir = c
                break
            }
        }
        await this.buildIndex();
        await this._startWatcher();
        this._registerIpcHandlers();
    }

    _registerIpcHandlers() {
        if (this._ipcBound) return;

        const handlers = {}
        handlers[IPC_HANDLER_KEYS.TASKS_LIST] = async (args) => this.listTasks(args)
        handlers[IPC_HANDLER_KEYS.TASKS_GET] = async (args) => this.getTask(args)
        handlers[IPC_HANDLER_KEYS.TASKS_CREATE] = async (args) => this.createTask(args)
        handlers[IPC_HANDLER_KEYS.TASKS_UPDATE] = async (args) => this.updateTask(args)
        handlers[IPC_HANDLER_KEYS.TASKS_DELETE] = async (args) => this.deleteTask(args)
        handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_GET] = async (args) => this.getFeature(args)
        handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_ADD] = async (args) => this.addFeature(args)
        handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_UPDATE] = async (args) => this.updateFeature(args)
        handlers[IPC_HANDLER_KEYS.TASKS_FEATURE_DELETE] = async (args) => this.deleteFeature(args)
        handlers[IPC_HANDLER_KEYS.TASKS_FEATURES_REORDER] = async (args) => this.reorderFeatures(args)

        handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_OUTBOUND] = async (args) => this.getReferencesOutbound(args)
        handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_INBOUND] = async (args) => this.getReferencesInbound(args)
        handlers[IPC_HANDLER_KEYS.TASKS_REFERENCE_VALIDATE] = async (args) => this.validateReference(args)
        handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_VALIDATE] = async (args) => this.validateReferences(args)
        handlers[IPC_HANDLER_KEYS.TASKS_REFERENCES_SEARCH] = async (args) => this.searchReferences(args)

        for(const handler of Object.keys(handlers)){
        ipcMain.handle(handler, async (event, args) => {
            try {
            return await handlers[handler](args)
            } catch (e) {
            console.error(`${handler} failed`, e);
            return { ok: false, error: String(e?.message || e) };
            }
        });
        }

        this._ipcBound = true;
    }

    async _startWatcher() {
        if (!(await pathExists(this.tasksDir))) {
            this.stopWatching();
            return;
        }
        this.stopWatching();
        this.watcher = chokidar.watch(path.join(this.tasksDir, '*/task.json'), {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
        });

        this.watcher
            .on('add', (path) => this.rebuildAndNotify(`File added: ${path}`))
            .on('change', (path) => this.rebuildAndNotify(`File changed: ${path}`))
            .on('unlink', (path) => this.rebuildAndNotify(`File removed: ${path}`));
    }

    async setTasksDir(absDir) {
        try {
            const next = path.isAbsolute(absDir) ? path.resolve(absDir) : path.resolve(absDir);
            const current = path.resolve(this.tasksDir || '');
            if (current === next) {
                return this.getIndex();
            }
            this.stopWatching();
            this.tasksDir = next;
            this.index.tasksDir = next;
            await this.buildIndex();
            await this._startWatcher();
            if (this.window) {
                this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE);
            }
            return this.getIndex();
        } catch (e) {
            this.index.errors.push({ file: absDir, errors: [e.message || String(e)] });
            if (this.window) {
                this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE);
            }
            return this.getIndex();
        }
    }

    getDefaultTasksDir() {
        return this.initialTasksDir || this.tasksDir;
    }

    async rebuildAndNotify(logMessage) {
        if (logMessage) console.log(logMessage);
        await this.buildIndex();
        if (this.window) {
            this.window.webContents.send(IPC_HANDLER_KEYS.TASKS_SUBSCRIBE);
        }
    }

    async buildIndex() {
        const startTime = Date.now();
        const newIndex = {
            ...this.index,
            updatedAt: new Date().toISOString(),
            tasksById: {},
            featuresByKey: {},
            errors: [],
        };

        try {
            const exists = await pathExists(this.tasksDir)
            if (!exists) {
                newIndex.errors.push({ file: this.tasksDir, errors: ['Tasks directory not found'] })
            } else {
                const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
                for (const dirent of taskDirs) {
                    if (dirent.isDirectory()) {
                        const taskId = dirent.name;
                        const taskFilePath = path.join(this.tasksDir, dirent.name, 'task.json');
                        try {
                            const content = await fs.readFile(taskFilePath, 'utf-8');
                            const task = JSON.parse(content);
                            const { valid, errors } = validateTask(task);
                            if (!valid) {
                                newIndex.errors.push({ file: taskFilePath, errors });
                                continue;
                            }
                            if(task.id !== taskId) {
                                newIndex.errors.push({ file: taskFilePath, errors: [`Task ID in file (${task.id}) does not match directory name (${taskId})`] });
                                continue;
                            }
                            newIndex.tasksById[task.id] = task;
                            task.features.forEach(feature => {
                                newIndex.featuresByKey[feature.id] = feature;
                            });
                        } catch (err) {
                            newIndex.errors.push({ file: taskFilePath, errors: [err.message] });
                        }
                    }
                }
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                newIndex.errors.push({ file: this.tasksDir, errors: [err.message] });
            }
        }

        this.index = newIndex;
        this.index.metrics.lastScanMs = Date.now() - startTime;
        this.index.metrics.lastScanCount = Object.keys(newIndex.tasksById).length;
    }

    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }

    async listTasks({project}){
        //TODO:
    }

    async getTask({project, id}) {
        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const existingIds = taskDirs
            .filter(d => d.isDirectory() && isNumericDir(d.name))
            .map(d => parseInt(d.name, 10));
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        const newTaskDir = path.join(this.tasksDir, String(nextId));
        await fs.mkdir(newTaskDir, { recursive: true });

        const newTask = {
            id: nextId,
            status: task.status || '-',
            title: task.title || '',
            description: task.description || '',
            features: task.features || [],
            rejection: task.rejection
        };

        newTask.features = newTask.features.map((f, index) => ({
            ...f,
            id: `${nextId}.${index + 1}`,
            status: f.status || '-'
        }));

        const { valid, errors } = validateTask(newTask);
        if (!valid) {
            await fs.rm(newTaskDir, { recursive: true, force: true });
            throw new Error(`Invalid new task: ${errors.join(', ')}`);
        }

        const taskPath = path.join(newTaskDir, 'task.json');
        await fs.writeFile(taskPath, JSON.stringify(newTask, null, 2), 'utf-8');
        await this.rebuildAndNotify(`New task ${nextId} added, index rebuilt.`);
        return { ok: true };
    }

    async createTask({project, task}) {
        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const existingIds = taskDirs
            .filter(d => d.isDirectory() && isNumericDir(d.name))
            .map(d => parseInt(d.name, 10));
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

        const newTaskDir = path.join(this.tasksDir, String(nextId));
        await fs.mkdir(newTaskDir, { recursive: true });

        const newTask = {
            id: nextId,
            status: task.status || '-',
            title: task.title || '',
            description: task.description || '',
            features: task.features || [],
            rejection: task.rejection
        };

        newTask.features = newTask.features.map((f, index) => ({
            ...f,
            id: `${nextId}.${index + 1}`,
            status: f.status || '-'
        }));

        const { valid, errors } = validateTask(newTask);
        if (!valid) {
            await fs.rm(newTaskDir, { recursive: true, force: true });
            throw new Error(`Invalid new task: ${errors.join(', ')}`);
        }

        const taskPath = path.join(newTaskDir, 'task.json');
        await fs.writeFile(taskPath, JSON.stringify(newTask, null, 2), 'utf-8');
        await this.rebuildAndNotify(`New task ${nextId} added, index rebuilt.`);
        return { ok: true };
    }

    async updateTask({taskId, data}) {
        console.log(`Updating task ${taskId}`);
        const taskDir = path.join(this.tasksDir, String(taskId));
        const taskPath = path.join(taskDir, 'task.json');
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
            throw new Error(`Invalid task update for ${taskId}: ${errors && errors.join ? errors.join(', ') : JSON.stringify(errors)}`);
        }

        await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8');
        await this.rebuildAndNotify(`Task ${taskId} updated`);
        return { ok: true };
    }

    async deleteTask({taskId}) {
        const taskDirPath = path.join(this.tasksDir, String(taskId));
    
        const deletedTask = this.index.tasksById[taskId];
        const deletedFeatureIds = new Set(deletedTask ? deletedTask.features.map(f => f.id) : []);

        try {
            await fs.rm(taskDirPath, { recursive: true, force: true });
        } catch (e) {
            throw new Error(`Could not delete task directory for task ${taskId}: ${e.message}`);
        }
    
        if (deletedFeatureIds.size > 0) {
            const tasksToUpdate = {};
            const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
            const taskDirNames = taskDirs.filter(d => d.isDirectory() && isNumericDir(d.name)).map(d => d.name);
    
            for (const currentTaskId of taskDirNames) {
                const currentTaskPath = path.join(this.tasksDir, currentTaskId, 'task.json');
                let currentTaskData;
                try {
                    currentTaskData = JSON.parse(await fs.readFile(currentTaskPath, 'utf-8'));
                } catch (e) {
                    console.warn(`Skipping dependency update for unreadable task: ${currentTaskId}`);
                    continue;
                }
    
                let taskModified = false;
                for (const feature of currentTaskData.features) {
                    if (!feature.dependencies || feature.dependencies.length === 0) continue;
    
                    const originalDepsCount = feature.dependencies.length;
                    feature.dependencies = feature.dependencies.filter(dep => !deletedFeatureIds.has(dep));
    
                    if (feature.dependencies.length !== originalDepsCount) {
                        taskModified = true;
                    }
                }
    
                if (taskModified) {
                    tasksToUpdate[currentTaskId] = currentTaskData;
                }
            }
    
            await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
                const filePath = path.join(this.tasksDir, id, 'task.json');
                return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            }));
        }
    
        await this.rebuildAndNotify(`Task ${taskId} deleted, dependencies updated, index rebuilt.`);
        return { ok: true };
    }

    async getFeature({project, taskId, featureId}) { //TODO:

    }

    async addFeature({project, taskId, feature}) {
        const taskPath = path.join(this.tasksDir, String(taskId), 'task.json');
        let taskData;
        try {
            const rawData = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(rawData);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        const newId = randomUUID()
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
        taskData.featureIdToDisplayIndex[newId] = taskData.features.length + 1;

        const { valid, errors } = validateTask(taskData);
        if (!valid) {
            throw new Error(`Invalid task after adding feature: ${errors.join(', ')}`);
        }

        await fs.writeFile(taskPath, JSON.stringify(taskData, null, 2), 'utf-8');
        await this.rebuildAndNotify(`Feature added to task ${taskId}, index rebuilt.`);
        return { ok: true };
    }

    async updateFeature({project, taskId, featureId, data}) {
        const taskDir = path.join(this.tasksDir, taskId);
        const taskPath = path.join(taskDir, 'task.json');
        let taskData;
        try {
            const raw = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(raw);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        const { id, ...patchable } = data || {};

        const features = taskData.features.map(f => f.id == featureId ? { ...f, ...patchable } : f);
        const next = { ...taskData, features };

        const { valid, errors } = validateTask(next);
        if (!valid) {
            throw new Error(`Invalid task update for ${taskId}: ${errors && errors.join ? errors.join(', ') : JSON.stringify(errors)}`);
        }

        await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8');
        await this.rebuildAndNotify(`Task ${taskId} updated`);
        return { ok: true };
    }

    async deleteFeature({project, taskId, featureId}) {
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

        let sortedFeatures = taskData.features.sort((a, b) => taskData.featureIdToDisplayIndex[a] - taskData.featureIdToDisplayIndex[b]);

        let newIndex = {}
        for(let i=0; i<sortedFeatures.length; i++){
            newIndex[sortedFeatures[i].id] = i+1
        }
        taskData.featureIdToDisplayIndex = newIndex;

        //TODO: go over all tasks/features that had this as a dependency -> remove it from them

        await this.rebuildAndNotify(`Feature ${featureId} deleted, index rebuilt.`);
        return { ok: true };
    }

    async reorderFeatures({project, taskId, payload}) {
        const taskPath = path.join(this.tasksDir, String(taskId), 'task.json');

        let taskData;
        try {
            const rawData = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(rawData);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        let features = taskData.features.sort((a, b) => taskData.featureIdToDisplayIndex[a] - taskData.featureIdToDisplayIndex[b]);

        const currentOrder = features.map(f => f.id);
        let newOrder;

        if (payload.fromIndex && payload.toIndex !== undefined) {
            if (payload.fromIndex < 0 || payload.fromIndex > features.length) throw new Error('Invalid source index');
            if (payload.toIndex < 0 || payload.toIndex > features.length) throw new Error('Invalid target index');
            newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIndex, 1);
            if (payload.toIndex >= newOrder.length) newOrder.push(moved)
            else newOrder.splice(payload.toIndex, 0, moved);
        } else {
            throw new Error('Invalid payload for reorder');
        }

        if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
            return { ok: true };
        }
        let newIndex = {}
        for(let i=0; i<newOrder.length; i++){
            newIndex[newOrder[i]] = newOrder+1
        }
        taskData.featureIdToDisplayIndex = newIndex;

        await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
            const filePath = path.join(this.tasksDir, id, 'task.json');
            return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        }));

        await this.rebuildAndNotify(`Features reordered for task ${taskId}, index rebuilt.`);
        return { ok: true };
    }

    async getReferencesOutbound({project, reference})
    {

    }
    async getReferencesInbound({project, reference})
    {
        
    }
    async validateReference({project, reference})
    {
        
    }
    async validateReferenceList({project, reference, proposed})
    {
        
    }
    async searchReferences({project, query, limit})
    {
        
    }
    
}
