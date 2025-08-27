import fs from 'fs/promises'
import path from 'path';
import chokidar from 'chokidar';
import { validateTask } from './validator';

function isNumericDir(name) {
    return /^\d+$/.test(name)
}

async function pathExists(p) {
    try { await fs.stat(p); return true } catch { return false }
}

function resolveTasksDir(projectRoot) {
    // Ensure absolute and robust resolution to the real tasks directory in dev/packaged runs
    const candidates = []
    const root = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot)
    candidates.push(path.join(root, 'tasks'))
    candidates.push(path.resolve(root, '..', 'tasks'))
    candidates.push(path.resolve(root, '..', '..', 'tasks'))
    candidates.push(path.resolve(process.cwd(), 'tasks'))
    for (const c of candidates) {
        // Note: do not await here, we use sync-ish check pattern via fs.stat in init
        // but we can return the first candidate; existence validated in init/buildIndex
        // We still prefer the first that exists.
    }
    return candidates[0] // initial default; we will correct in init if needed
}

export class TasksIndexer {
    constructor(projectRoot, window) {
        this.projectRoot = path.isAbsolute(projectRoot) ? projectRoot : path.resolve(projectRoot);
        this.tasksDir = resolveTasksDir(this.projectRoot);
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
    }

    getIndex() {
        return this.index;
    }

    async init() {
        // Ensure tasksDir resolves to an existing path; try common fallbacks
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
                break
            }
        }
        await this.buildIndex();
        this.watcher = chokidar.watch(path.join(this.tasksDir, '*/task.json'), {
            ignored: /(^|[/\\])\../,
            persistent: true,
            ignoreInitial: true,
        });

        this.watcher
            .on('add', (path) => this.rebuildAndNotify(`File added: ${path}`))
            .on('change', (path) => this.rebuildAndNotify(`File changed: ${path}`))
            .on('unlink', (path) => this.rebuildAndNotify(`File removed: ${path}`));
    }
    
    async rebuildAndNotify(logMessage) {
        if (logMessage) console.log(logMessage);
        await this.buildIndex();
        if (this.window) {
            this.window.webContents.send('tasks-index:update', this.getIndex());
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
                    if (dirent.isDirectory() && isNumericDir(dirent.name)) {
                        const taskId = parseInt(dirent.name, 10);
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

    async deleteFeature(taskId, featureId) {
        console.log(`Deleting feature ${featureId} from task ${taskId}`);
        const taskPath = path.join(this.tasksDir, String(taskId), 'task.json');
        
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

        const idUpdateMap = new Map();
        idUpdateMap.set(featureId, null); 

        taskData.features.forEach((feature, index) => {
            const newFeatureId = `${taskId}.${index + 1}`;
            if (feature.id !== newFeatureId) {
                idUpdateMap.set(feature.id, newFeatureId);
                feature.id = newFeatureId;
            }
        });

        const tasksToUpdate = {};
        
        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const taskDirNames = taskDirs.filter(d => d.isDirectory() && isNumericDir(d.name)).map(d => d.name);

        for (const currentTaskId of taskDirNames) {
            const currentTaskPath = path.join(this.tasksDir, currentTaskId, 'task.json');
            let currentTaskData;

            if (currentTaskId === String(taskId)) {
                currentTaskData = taskData;
            } else {
                 try {
                    currentTaskData = JSON.parse(await fs.readFile(currentTaskPath, 'utf-8'));
                 } catch (e) {
                    console.warn(`Skipping dependency update for unreadable task: ${currentTaskId}`);
                    continue;
                 }
            }

            let taskModified = false;
            for (const feature of currentTaskData.features) {
                if (!feature.dependencies || feature.dependencies.length === 0) continue;

                const originalDepsJSON = JSON.stringify(feature.dependencies);
                feature.dependencies = feature.dependencies
                    .map(dep => idUpdateMap.has(dep) ? idUpdateMap.get(dep) : dep)
                    .filter(dep => dep !== null);
                
                if (JSON.stringify(feature.dependencies) !== originalDepsJSON) {
                    taskModified = true;
                }
            }
            
            if (taskModified || currentTaskId === String(taskId)) {
                tasksToUpdate[currentTaskId] = currentTaskData;
            }
        }
        
        await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
            const filePath = path.join(this.tasksDir, id, 'task.json');
            return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        }));

        await this.rebuildAndNotify(`Feature ${featureId} deleted, index rebuilt.`);
        return { ok: true };
    }

    async deleteTask(taskId) {
        console.log(`Deleting task ${taskId}`);
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

    async reorderFeatures(taskId, payload) {
        console.log(`Reordering features for task ${taskId}`);
        const taskPath = path.join(this.tasksDir, String(taskId), 'task.json');

        let taskData;
        try {
            const rawData = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(rawData);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        let features = taskData.features;
        const currentOrder = features.map(f => f.id);
        let newOrder;

        if (payload.order) {
            newOrder = payload.order;
            const orderSet = new Set(newOrder);
            if (orderSet.size !== currentOrder.length || !newOrder.every(id => currentOrder.includes(id))) {
                throw new Error('Invalid order: must include all existing feature IDs without duplicates');
            }
        } else if (payload.fromId && payload.toIndex !== undefined) {
            const fromIndex = features.findIndex(f => f.id === payload.fromId);
            if (fromIndex === -1) throw new Error(`Feature ${payload.fromId} not found`);
            if (payload.toIndex < 0 || payload.toIndex > features.length) throw new Error('Invalid target index');
            newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIndex, 1);
            // Allow moving to end (toIndex === length)
            if (payload.toIndex >= newOrder.length) newOrder.push(moved)
            else newOrder.splice(payload.toIndex, 0, moved);
        } else {
            throw new Error('Invalid payload for reorder');
        }

        // Early exit if order did not change
        if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
            return { ok: true };
        }

        // Reorder features
        const reorderedFeatures = newOrder.map(id => features.find(f => f.id === id));

        // Renumber IDs
        const idUpdateMap = new Map();
        reorderedFeatures.forEach((feature, index) => {
            const newId = `${taskId}.${index + 1}`;
            if (feature.id !== newId) {
                idUpdateMap.set(feature.id, newId);
                feature.id = newId;
            }
        });

        // Update dependencies within this task
        reorderedFeatures.forEach(feature => {
            if (feature.dependencies) {
                feature.dependencies = feature.dependencies.map(dep => idUpdateMap.has(dep) ? idUpdateMap.get(dep) : dep);
            }
        });

        taskData.features = reorderedFeatures;

        // Update dependencies across all tasks
        const tasksToUpdate = {};
        tasksToUpdate[String(taskId)] = taskData;

        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const taskDirNames = taskDirs.filter(d => d.isDirectory() && isNumericDir(d.name)).map(d => d.name);

        for (const currentTaskId of taskDirNames) {
            if (currentTaskId === String(taskId)) continue;

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

                const updatedDeps = feature.dependencies.map(dep => idUpdateMap.has(dep) ? idUpdateMap.get(dep) : dep);

                if (JSON.stringify(updatedDeps) !== JSON.stringify(feature.dependencies)) {
                    feature.dependencies = updatedDeps;
                    taskModified = true;
                }
            }

            if (taskModified) {
                tasksToUpdate[currentTaskId] = currentTaskData;
            }
        }

        // Write updated tasks
        await Promise.all(Object.entries(tasksToUpdate).map(([id, data]) => {
            const filePath = path.join(this.tasksDir, id, 'task.json');
            return fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        }));

        await this.rebuildAndNotify(`Features reordered for task ${taskId}, index rebuilt.`);
        return { ok: true };
    }

    async reorderTasks(payload) {
        console.log('Reordering tasks');
        const tasksDirAbs = path.resolve(this.tasksDir);
        const taskDirs = await fs.readdir(tasksDirAbs, { withFileTypes: true });
        let currentOrder = taskDirs
            .filter(d => d.isDirectory() && isNumericDir(d.name))
            .map(d => parseInt(d.name, 10))
            .sort((a, b) => a - b);

        let newOrder;
        if (payload.order) {
            newOrder = payload.order;
            const orderSet = new Set(newOrder);
            if (orderSet.size !== currentOrder.length || !newOrder.every(id => currentOrder.includes(id))) {
                throw new Error('Invalid order: must include all existing task IDs without duplicates');
            }
        } else if (payload.fromId && payload.toIndex !== undefined) {
            const fromIndex = currentOrder.indexOf(payload.fromId);
            if (fromIndex === -1) throw new Error(`Task ${payload.fromId} not found`);
            if (payload.toIndex < 0 || payload.toIndex > currentOrder.length) throw new Error('Invalid target index');
            newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIndex, 1);
            // Allow moving to end (toIndex === length)
            if (payload.toIndex >= newOrder.length) newOrder.push(moved)
            else newOrder.splice(payload.toIndex, 0, moved);
        } else {
            throw new Error('Invalid payload for reorder');
        }

        // Early exit if order did not change (prevents unnecessary renames and ENOENT issues)
        if (JSON.stringify(newOrder) === JSON.stringify(currentOrder)) {
            return { ok: true };
        }

        const newIdForOld = new Map();
        newOrder.forEach((oldId, index) => {
            newIdForOld.set(oldId, index + 1);
        });

        const featureIdUpdateMap = new Map();
        const tasksData = {};
        for (const oldId of currentOrder) {
            const taskPath = path.join(tasksDirAbs, String(oldId), 'task.json');
            const raw = await fs.readFile(taskPath, 'utf-8');
            tasksData[oldId] = JSON.parse(raw);
        }

        Object.entries(tasksData).forEach(([oldTaskIdStr, task]) => {
            const oldTaskId = parseInt(oldTaskIdStr);
            const newTaskId = newIdForOld.get(oldTaskId);
            task.id = newTaskId;
            task.features.forEach((feature, index) => {
                const oldFeatureId = feature.id;
                const newFeatureId = `${newTaskId}.${index + 1}`;
                featureIdUpdateMap.set(oldFeatureId, newFeatureId);
                feature.id = newFeatureId;
            });
        });

        Object.values(tasksData).forEach(task => {
            task.features.forEach(feature => {
                if (feature.dependencies) {
                    feature.dependencies = feature.dependencies.map(dep => featureIdUpdateMap.get(dep) || dep);
                }
            });
        });

        // Use a staging directory to avoid rename conflicts and ENOENT due to path resolution
        const stagingDir = path.join(tasksDirAbs, `.reorder_tmp_${Date.now()}`)
        await fs.mkdir(stagingDir, { recursive: true })

        // Move all current numeric task dirs into staging (by oldId)
        for (const oldId of currentOrder) {
            const oldDir = path.join(tasksDirAbs, String(oldId));
            const stagedDir = path.join(stagingDir, String(oldId));
            // Verify exists before rename to avoid ENOENT confusing errors
            if (!(await pathExists(oldDir))) {
                throw new Error(`Source task directory not found: ${oldDir}`)
            }
            await fs.rename(oldDir, stagedDir);
        }

        // Move from staging to new locations (by newId) and write updated task.json
        for (const [newIndex, oldId] of newOrder.entries()) {
            const newId = newIndex + 1;
            const stagedDir = path.join(stagingDir, String(oldId));
            const newDir = path.join(tasksDirAbs, String(newId));
            await fs.rename(stagedDir, newDir);
            const newTaskPath = path.join(newDir, 'task.json');
            await fs.writeFile(newTaskPath, JSON.stringify(tasksData[oldId], null, 2), 'utf-8');
        }

        // Attempt to remove the staging folder (should be empty)
        try { await fs.rmdir(stagingDir) } catch { /* ignore */ }

        await this.rebuildAndNotify('Tasks reordered, index rebuilt.');
        return { ok: true };
    }

    // NEW: updateTask to support status/title/description/rejection updates from renderer (e.g., board drag)
    async updateTask(taskId, data) {
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

        // Do not allow changing ID via updateTask; everything else is merged
        const { id, features, ...patchable } = data || {};
        const next = { ...taskData, ...patchable };

        // Validate before writing
        const { valid, errors } = validateTask(next);
        if (!valid) {
            throw new Error(`Invalid task update for ${taskId}: ${errors && errors.join ? errors.join(', ') : JSON.stringify(errors)}`);
        }

        await fs.writeFile(taskPath, JSON.stringify(next, null, 2), 'utf-8');
        await this.rebuildAndNotify(`Task ${taskId} updated`);
        return { ok: true };
    }

    async updateFeature(taskId, featureId, data) {
        console.log(`Updating feature ${featureId}`);
        const taskDir = path.join(this.tasksDir, String(taskId));
        const taskPath = path.join(taskDir, 'task.json');
        let taskData;
        try {
            const raw = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(raw);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        // Do not allow changing ID via updateFeature; everything else is merged
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

    async addFeature(taskId, feature) {
        console.log(`Adding feature to task ${taskId}`);
        const taskPath = path.join(this.tasksDir, String(taskId), 'task.json');
        let taskData;
        try {
            const rawData = await fs.readFile(taskPath, 'utf-8');
            taskData = JSON.parse(rawData);
        } catch (e) {
            throw new Error(`Could not read or parse task file for task ${taskId}: ${e.message}`);
        }

        const newIndex = taskData.features.length + 1;
        const newId = `${taskId}.${newIndex}`;
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

        const { valid, errors } = validateTask(taskData);
        if (!valid) {
            throw new Error(`Invalid task after adding feature: ${errors.join(', ')}`);
        }

        await fs.writeFile(taskPath, JSON.stringify(taskData, null, 2), 'utf-8');
        await this.rebuildAndNotify(`Feature added to task ${taskId}, index rebuilt.`);
        return { ok: true };
    }

    async addTask(task) {
        console.log('Adding new task');
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
}
