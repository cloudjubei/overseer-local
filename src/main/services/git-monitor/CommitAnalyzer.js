import { exec } from 'node:child_process';

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

/**
 * CommitAnalyzer inspects a specific commit (or branch ref) to locate a task.json
 * under tasks/<taskId>/task.json and parse feature/status info without checkout.
 */
export class CommitAnalyzer {
  /**
   * @param {object} options
   * @param {string} options.repoPath - Absolute or relative path to the git repository
   */
  constructor({ repoPath } = {}) {
    this.repoPath = repoPath || process.cwd();
  }

  /**
   * List candidate task.json paths in a given tree-ish using ls-tree.
   * @param {string} treeish - commit SHA or ref name
   * @returns {Promise<string[]>}
   */
  async listTaskJsonPaths(treeish) {
    // Use git ls-tree -r --name-only <treeish> to scan file names
    const out = await run(`git ls-tree -r --name-only ${treeish}`, this.repoPath);
    const files = out.split('\n').map(s => s.trim()).filter(Boolean);
    // We only consider paths that match tasks/<id>/task.json
    // Keep them ordered as listed
    return files.filter(p => /^tasks\/[A-Za-z0-9\-]{6,}\/task\.json$/.test(p));
  }

  /**
   * Read a file at a given path from the tree-ish using git show.
   * @param {string} treeish
   * @param {string} filePath
   * @returns {Promise<string>}
   */
  async readFileAt(treeish, filePath) {
    const content = await run(`git show ${treeish}:${filePath}`, this.repoPath);
    return content;
  }

  /**
   * Parse a task.json string safely.
   * @param {string} jsonStr
   * @returns {{ ok: true, value: any } | { ok: false, error: Error }}
   */
  parseTaskJson(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      return { ok: true, value: obj };
    } catch (e) {
      return { ok: false, error: e };
    }
  }

  /**
   * Extract a simplified view of task status and features from task.json
   * @param {any} taskObj
   * @returns {{ taskId?: string, status?: string, title?: string, features?: Array<{id:string,status?:string,title?:string}> }}
   */
  extractSummary(taskObj) {
    const features = Array.isArray(taskObj?.features)
      ? taskObj.features.map(f => ({ id: f?.id, status: f?.status, title: f?.title })).filter(f => !!f.id)
      : [];
    return {
      taskId: taskObj?.id,
      status: taskObj?.status,
      title: taskObj?.title,
      features,
    };
  }

  /**
   * Analyze a commit/ref for task.json files and return parsed info.
   * @param {string} treeish - commit SHA or ref name (e.g., features/<taskId> or SHA)
   * @returns {Promise<{
   *   treeish: string,
   *   found: boolean,
   *   files: Array<{
   *     path: string,
   *     parseOk: boolean,
   *     error?: string,
   *     raw?: string,
   *     task?: any,
   *     summary?: { taskId?: string, status?: string, title?: string, features?: Array<{id:string,status?:string,title?:string}> }
   *   }>
   * }>} 
   */
  async analyze(treeish) {
    const result = { treeish, found: false, files: [] };
    const taskFiles = await this.listTaskJsonPaths(treeish);
    if (taskFiles.length === 0) return result;

    result.found = true;
    for (const filePath of taskFiles) {
      try {
        const raw = await this.readFileAt(treeish, filePath);
        const parsed = this.parseTaskJson(raw);
        if (parsed.ok) {
          const summary = this.extractSummary(parsed.value);
          result.files.push({ path: filePath, parseOk: true, raw, task: parsed.value, summary });
        } else {
          result.files.push({ path: filePath, parseOk: false, error: parsed.error?.message || String(parsed.error) });
        }
      } catch (e) {
        result.files.push({ path: filePath, parseOk: false, error: e?.message || String(e) });
      }
    }
    return result;
  }
}

export default CommitAnalyzer;
