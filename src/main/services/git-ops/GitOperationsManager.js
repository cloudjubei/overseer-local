import { ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import IPC_HANDLER_KEYS from '../../../ipcHandlersKeys.js';
import { projectsManager } from '../../../managers.js';

function runGit(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
      else reject(Object.assign(new Error(stderr || `git ${args.join(' ')} failed with code ${code}`), { stdout, stderr, code }));
    });
  });
}

async function isGitRepo(cwd) {
  try {
    const { stdout } = await runGit(['rev-parse', '--is-inside-work-tree'], cwd);
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

function toFeatureBranchName(taskId) {
  // basic normalization similar to branchNaming.js
  if (typeof taskId !== 'string') throw new Error('Invalid taskId');
  const id = taskId.trim().replace(/\s+/g, '-').replace(/^\/+/, '').replace(/\/+$/, '');
  if (!id) throw new Error('Invalid taskId: empty after normalization');
  if (/[^A-Za-z0-9._\-\/]/.test(id)) throw new Error('Invalid taskId: contains unsupported characters');
  if (id.split('/').some(seg => seg === '.' || seg === '..' || seg === '')) throw new Error('Invalid taskId: contains invalid path segments');
  return `features/${id}`;
}

export class GitOperationsManager {
  constructor(projectRoot, window, projectsMgr) {
    this.projectRoot = projectRoot;
    this.window = window;
    this.projectsManager = projectsMgr;
    this._ipcBound = false;
  }

  async init() {
    this._registerIpcHandlers();
  }

  _registerIpcHandlers() {
    if (this._ipcBound) return;

    ipcMain.handle(IPC_HANDLER_KEYS.GIT_MERGE_TASK_BRANCH, async (_evt, { projectId, taskId, options = {} }) => {
      try {
        const res = await this.mergeTaskBranch(projectId, taskId, options);
        return res;
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    });

    ipcMain.handle(IPC_HANDLER_KEYS.GIT_LIST_FEATURE_BRANCHES, async (_evt, { projectId }) => {
      try {
        const res = await this.listFeatureBranches(projectId);
        return res;
      } catch (e) {
        return { ok: false, error: e?.message || String(e) };
      }
    });

    this._ipcBound = true;
  }

  async _getProjectRoot(projectId) {
    const project = await this.projectsManager.getProject(projectId);
    if (!project) throw new Error("project couldn't be found");
    const root = path.resolve(this.projectsManager.projectsDir, project.path);
    return root;
  }

  async listFeatureBranches(projectId) {
    const cwd = await this._getProjectRoot(projectId);
    if (!(await isGitRepo(cwd))) {
      return { ok: false, error: `Not a git repository: ${cwd}` };
    }
    await runGit(['fetch', '--all', '--prune'], cwd).catch(() => {});
    const { stdout } = await runGit(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], cwd);
    const local = stdout.split('\n').map(s => s.trim()).filter(Boolean);
    const features = local.filter(b => b.startsWith('features/') && b.length > 'features/'.length);
    return { ok: true, branches: features };
  }

  async mergeTaskBranch(projectId, taskId, options = {}) {
    const {
      targetBranch = 'main',
      ffOnly = true,
      squash = false,
      noCommit = false, // when squash=false and ffOnly=false, allow creating a merge commit without auto-commit
      allowUnrelated = false,
      push = false, // optionally push after merge
    } = options || {};

    const cwd = await this._getProjectRoot(projectId);
    if (!(await isGitRepo(cwd))) {
      return { ok: false, error: `Not a git repository: ${cwd}` };
    }

    const featureBranch = toFeatureBranchName(taskId);

    // Fetch latest
    await runGit(['fetch', '--all', '--prune'], cwd).catch(() => {});

    // Ensure local feature branch exists (create from origin if necessary)
    const featureExistsLocal = await runGit(['show-ref', '--verify', '--quiet', `refs/heads/${featureBranch}`], cwd)
      .then(() => true).catch(() => false);
    if (!featureExistsLocal) {
      // Try to fetch origin/<branch> into local branch
      const fetched = await runGit(['fetch', 'origin', `${featureBranch}:refs/heads/${featureBranch}`], cwd)
        .then(() => true).catch(() => false);
      if (!fetched) {
        return { ok: false, error: `Feature branch not found locally or on origin: ${featureBranch}` };
      }
    }

    // Checkout target branch
    const targetExists = await runGit(['show-ref', '--verify', '--quiet', `refs/heads/${targetBranch}`], cwd)
      .then(() => true).catch(() => false);
    if (!targetExists) {
      // Try to create local target from origin
      const fetchedTarget = await runGit(['fetch', 'origin', `${targetBranch}:refs/heads/${targetBranch}`], cwd)
        .then(() => true).catch(() => false);
      if (!fetchedTarget) {
        return { ok: false, error: `Target branch not found: ${targetBranch}` };
      }
    }

    await runGit(['checkout', targetBranch], cwd);
    // Pull latest into target (fast-forward only to avoid merges from remote)
    await runGit(['pull', '--ff-only'], cwd).catch(() => {});

    const currentBranch = targetBranch;

    // Merge strategy
    let mergeOutput = '';
    let mergeError = '';
    try {
      if (squash) {
        // Squash merge, then commit
        await runGit(['merge', '--squash', featureBranch], cwd);
        const msg = `Merge feature task ${taskId} (squash)`;
        const commitArgs = ['commit', '-m', msg];
        await runGit(commitArgs, cwd);
        mergeOutput = 'Squash merge completed and committed.';
      } else if (ffOnly) {
        const { stdout } = await runGit(['merge', '--ff-only', featureBranch], cwd);
        mergeOutput = stdout || 'Fast-forward merge completed';
      } else {
        const args = ['merge', '--no-ff'];
        if (noCommit) args.push('--no-commit');
        if (allowUnrelated) args.push('--allow-unrelated-histories');
        args.push(featureBranch);
        const { stdout } = await runGit(args, cwd);
        mergeOutput = stdout || 'Merge completed';
      }
    } catch (e) {
      // Try to abort merge to leave repo clean
      try { await runGit(['merge', '--abort'], cwd); } catch {}
      mergeError = e?.stderr || e?.message || String(e);
      return { ok: false, error: mergeError, conflict: /Merge conflict|Automatic merge failed|CONFLICT/.test(mergeError), targetBranch: currentBranch, featureBranch };
    }

    // Optionally push
    if (push) {
      try {
        await runGit(['push', 'origin', currentBranch], cwd);
      } catch (e) {
        // Non-fatal push failure
        mergeOutput += `\nPush failed: ${e?.message || e}`;
      }
    }

    return { ok: true, merged: true, message: mergeOutput, targetBranch: currentBranch, featureBranch };
  }
}

export default GitOperationsManager;
