import fs from 'fs/promises'
import path from 'path';
import chokidar from 'chokidar';
import { validateTask } from './validator';

export class TasksIndexer {
    constructor(projectRoot, window) {
        this.projectRoot = projectRoot;
        this.tasksDir = path.join(projectRoot, 'tasks');
        this.index = {
            root: projectRoot,
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
            const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
            for (const dirent of taskDirs) {
                if (dirent.isDirectory() && /^\d+$/.test(dirent.name)) {
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
        const taskDirNames = taskDirs.filter(d => d.isDirectory() && /^\d+$/.test(d.name)).map(d => d.name);

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
            const taskDirNames = taskDirs.filter(d => d.isDirectory() && /^\d+$/.test(d.name)).map(d => d.name);
    
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
            if (payload.toIndex < 0 || payload.toIndex >= features.length) throw new Error('Invalid target index');
            newOrder = [...currentOrder];
            const [moved] = newOrder.splice(fromIndex, 1);
            newOrder.splice(payload.toIndex, 0, moved);
        } else {
            throw new Error('Invalid payload for reorder');
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

        taskData.features = reorderedFeatures;

        // Update dependencies across all tasks
        const tasksToUpdate = {};
        tasksToUpdate[String(taskId)] = taskData;

        const taskDirs = await fs.readdir(this.tasksDir, { withFileTypes: true });
        const taskDirNames = taskDirs.filter(d => d.isDirectory() && /^\d+$/.test(d.name)).map(d => d.name);

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
}
