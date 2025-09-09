import { EventEmitter } from 'node:events';
import { exec } from 'node:child_process';
import path from 'node:path';

function run(cmd, cwd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout.trim());
    });
  });
}

// Utility to check if a path is inside a git repo (by checking .git exists)
async function isGitRepo(dir) {
  try {
    const res = await run('git rev-parse --is-inside-work-tree', dir);
    return res === 'true';
  } catch {
    return false;
  }
}

export class GitMonitorService extends EventEmitter {
  constructor(options) {
    super();
    const {
      repoPath,
      intervalMs = 60_000,
      fetchOnStart = true,
      branches = null, // array of branch names to monitor; null = all local branches
    } = options || {};

    this.repoPath = repoPath;
    this.intervalMs = intervalMs;
    this.fetchOnStart = fetchOnStart;
    this.branchesFilter = branches;

    this._timer = null;
    this._running = false;
    this._lastBranchHeads = new Map(); // branchName -> commitSha
  }

  async start() {
    if (this._running) return;

    const repoPath = this.repoPath || process.cwd();
    const valid = await isGitRepo(repoPath);
    if (!valid) {
      this.emit('error', new Error(`Not a git repository: ${repoPath}`));
      return;
    }

    this._running = true;
    try {
      if (this.fetchOnStart) {
        await this._fetchAll();
      }
      await this._snapshotBranchHeads();
    } catch (e) {
      this.emit('error', e);
    }

    this._schedule();
    this.emit('started', { repoPath });
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this.emit('stopped');
  }

  _schedule() {
    if (!this._running) return;
    this._timer = setTimeout(() => this._tick().catch(err => this.emit('error', err)), this.intervalMs);
  }

  async _tick() {
    if (!this._running) return;

    // fetch latest
    try {
      await this._fetchAll();
    } catch (e) {
      this.emit('error', e);
    }

    // detect new commits per branch
    try {
      const changes = await this._detectBranchHeadChanges();
      if (changes.length > 0) {
        this.emit('branchesUpdated', changes);
      }
    } catch (e) {
      this.emit('error', e);
    }

    this._schedule();
  }

  async _fetchAll() {
    await run('git fetch --all --prune', this.repoPath);
  }

  async _getLocalBranches() {
    const raw = await run('git for-each-ref --format=%(refname:short) refs/heads', this.repoPath);
    const list = raw.split('\n').map(s => s.trim()).filter(Boolean);
    if (this.branchesFilter && Array.isArray(this.branchesFilter)) {
      const set = new Set(this.branchesFilter);
      return list.filter(b => set.has(b));
    }
    return list;
  }

  async _getBranchHead(branch) {
    const sha = await run(`git rev-parse ${branch}`, this.repoPath);
    return sha;
  }

  async _snapshotBranchHeads() {
    const branches = await this._getLocalBranches();
    this._lastBranchHeads.clear();
    for (const b of branches) {
      try {
        const sha = await this._getBranchHead(b);
        this._lastBranchHeads.set(b, sha);
      } catch (e) {
        this.emit('error', new Error(`Failed to snapshot branch ${b}: ${e.message}`));
      }
    }
  }

  async _detectBranchHeadChanges() {
    const branches = await this._getLocalBranches();
    const results = [];

    for (const b of branches) {
      try {
        const newSha = await this._getBranchHead(b);
        const oldSha = this._lastBranchHeads.get(b);
        if (!oldSha) {
          this._lastBranchHeads.set(b, newSha);
          results.push({ branch: b, oldSha: null, newSha, commits: [] });
          continue;
        }
        if (newSha !== oldSha) {
          // get list of new commits from oldSha..newSha (if reachable)
          let commits = [];
          try {
            const raw = await run(`git rev-list --pretty=format:%H%x09%s ${oldSha}..${newSha}`, this.repoPath);
            commits = raw
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)
              .filter(line => /\b[0-9a-f]{7,40}\b/.test(line))
              .map(line => {
                const [hash, ...msgParts] = line.split('\t');
                return { hash, message: msgParts.join('\t') };
              });
          } catch {
            // If range isn't reachable (force push), just report head change
            commits = [];
          }
          results.push({ branch: b, oldSha, newSha, commits });
          this._lastBranchHeads.set(b, newSha);
        }
      } catch (e) {
        this.emit('error', new Error(`Failed to check branch ${b}: ${e.message}`));
      }
    }

    return results;
  }
}
