"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { EventEmitter } = require("node:events");

// Allowed statuses from docs/tasks/task_format.py
const STATUSES = new Set(["+", "~", "-", "?", "="]);

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function validateFeature(feature, i, taskId) {
  const errors = [];
  if (!isObject(feature)) {
    return [false, [`Feature at index ${i} in task ${taskId} is not an object`]];
  }
  const required = ["id", "status", "title", "description", "plan", "context", "acceptance"];
  for (const k of required) {
    if (!(k in feature)) errors.push(`Feature missing required field '${k}'`);
  }
  if (typeof feature.id !== "string") errors.push("Feature.id must be string");
  if (!STATUSES.has(feature.status)) errors.push("Feature.status must be one of +,~, - ,?,=");
  if (typeof feature.title !== "string") errors.push("Feature.title must be string");
  if (typeof feature.description !== "string") errors.push("Feature.description must be string");
  if (typeof feature.plan !== "string") errors.push("Feature.plan must be string");
  if (!Array.isArray(feature.context) || feature.context.some((x) => typeof x !== "string")) errors.push("Feature.context must be string[]");
  if (!Array.isArray(feature.acceptance) || feature.acceptance.some((x) => typeof x !== "string")) errors.push("Feature.acceptance must be string[]");
  if (feature.dependencies && (!Array.isArray(feature.dependencies) || feature.dependencies.some((x) => typeof x !== "string"))) {
    errors.push("Feature.dependencies must be string[] if provided");
  }
  if (feature.rejection && typeof feature.rejection !== "string") errors.push("Feature.rejection must be string if provided");
  return [errors.length === 0, errors];
}

function validateTask(task) {
  const errors = [];
  if (!isObject(task)) return [false, ["Task must be an object"]];
  const required = ["id", "status", "title", "description", "features"];
  for (const k of required) {
    if (!(k in task)) errors.push(`Task missing required field '${k}'`);
  }
  if (!Number.isInteger(task.id)) errors.push("Task.id must be an integer");
  if (!STATUSES.has(task.status)) errors.push("Task.status must be one of +,~, -,?,=");
  if (typeof task.title !== "string") errors.push("Task.title must be string");
  if (typeof task.description !== "string") errors.push("Task.description must be string");
  if (!Array.isArray(task.features)) errors.push("Task.features must be an array");
  if (task.rejection && typeof task.rejection !== "string") errors.push("Task.rejection must be string if provided");
  const featureErrors = [];
  if (Array.isArray(task.features)) {
    task.features.forEach((f, i) => {
      const [ok, errs] = validateFeature(f, i, task.id);
      if (!ok) featureErrors.push(...errs);
    });
  }
  return [errors.length === 0 && featureErrors.length === 0, [...errors, ...featureErrors]];
}

function nowMs() {
  const n = process.hrtime.bigint();
  return Number(n / 1000000n);
}

class TasksIndexer extends EventEmitter {
  constructor(projectRoot) {
    super();
    this.projectRoot = projectRoot;
    this.tasksDir = path.join(projectRoot, "tasks");
    this.index = {
      root: this.projectRoot,
      tasksDir: this.tasksDir,
      updatedAt: Date.now(),
      tasksById: {},
      featuresByKey: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
    };
    this._watchers = new Map(); // key -> fs.FSWatcher
    this._debounceTimer = null;
  }

  getIndex() {
    return this.index;
  }

  async init() {
    await this.buildIndex();
    await this.startWatching();
  }

  async buildIndex() {
    const t0 = nowMs();
    const idx = {
      root: this.projectRoot,
      tasksDir: this.tasksDir,
      updatedAt: Date.now(),
      tasksById: {},
      featuresByKey: {},
      errors: [],
      metrics: { lastScanMs: 0, lastScanCount: 0 },
    };
    let taskDirs = [];
    try {
      const entries = await fsp.readdir(this.tasksDir, { withFileTypes: true });
      taskDirs = entries.filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => path.join(this.tasksDir, e.name));
    } catch (err) {
      // no tasks dir yet – index empty
      idx.errors.push({ path: this.tasksDir, error: String(err) });
    }

    const loadPromises = taskDirs.map(async (dir) => {
      const idStr = path.basename(dir);
      const file = path.join(dir, "task.json");
      try {
        const data = await fsp.readFile(file, "utf8");
        const json = JSON.parse(data);
        const [ok, errors] = validateTask(json);
        if (!ok) {
          idx.errors.push({ path: file, error: errors.join("; ") });
          return;
        }
        // Normalize and add
        idx.tasksById[String(json.id)] = json;
        if (Array.isArray(json.features)) {
          for (const f of json.features) {
            const key = `${json.id}:${f.id}`;
            idx.featuresByKey[key] = { ...f, taskId: json.id };
          }
        }
      } catch (err) {
        idx.errors.push({ path: file, error: String(err) });
      }
    });

    await Promise.all(loadPromises);
    idx.metrics.lastScanCount = Object.keys(idx.tasksById).length;
    idx.metrics.lastScanMs = Math.max(0, nowMs() - t0);

    this.index = idx;
    this.emit("updated", this.index);
    return idx;
  }

  async startWatching() {
    // Clear existing watchers
    this.stopWatching();

    // Watch the tasks root for new/deleted task directories and changes.
    if (!fs.existsSync(this.tasksDir)) {
      return; // nothing to watch yet
    }

    const rootWatcherKey = this.tasksDir;
    const rootWatcher = fs.watch(this.tasksDir, { persistent: true }, (eventType, filename) => {
      // Any rename or change under tasks root triggers a rescan with debounce
      this._debouncedRebuild();
      // If a new numeric dir appears, attach a watcher to its task.json once it exists.
    });
    this._watchers.set(rootWatcherKey, rootWatcher);

    // Attach watchers for each task.json present at startup
    const entries = await fsp.readdir(this.tasksDir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      if (e.isDirectory() && /^\d+$/.test(e.name)) {
        const dir = path.join(this.tasksDir, e.name);
        this._watchTaskDir(dir);
      }
    }
  }

  _watchTaskDir(dir) {
    const key = path.join(dir, "task.json");
    if (this._watchers.has(key)) return;
    try {
      const watcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (!filename) {
          this._debouncedRebuild();
          return;
        }
        if (filename === "task.json" || /^test/i.test(filename) || eventType === "rename") {
          this._debouncedRebuild();
        }
      });
      this._watchers.set(key, watcher);
    } catch (e) {
      // Ignore watcher errors for directories that may disappear
    }
  }

  _debouncedRebuild(delayMs = 100) {
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.buildIndex().catch(() => {});
    }, delayMs);
  }

  stopWatching() {
    for (const [key, watcher] of this._watchers) {
      try { watcher.close(); } catch (_) {}
      this._watchers.delete(key);
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
}

module.exports = { TasksIndexer };
