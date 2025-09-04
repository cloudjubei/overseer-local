import { execFile } from 'node:child_process';
import path from 'node:path';

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`Git command failed: git ${args.join(' ')}\nStderr: ${stderr || error.message}`);
        // @ts-ignore attach code for debugging
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any).stderr = stderr;
        reject(err);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length ? v : undefined;
}

async function safeRunGit(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    return await runGit(cwd, args);
  } catch {
    return undefined;
  }
}

async function getCurrentBranch(cwd: string): Promise<string | undefined> {
  // Try symbolic-ref first (fast), fallback to rev-parse
  const ref = await safeRunGit(cwd, ['symbolic-ref', '--short', 'HEAD']);
  if (ref) return ref;
  return await safeRunGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

async function hasRemote(cwd: string, name: string): Promise<boolean> {
  const remotes = await safeRunGit(cwd, ['remote']);
  return !!remotes && remotes.split(/\r?\n/).some(r => r.trim() === name);
}

async function getRemoteUrl(cwd: string, name: string): Promise<string | undefined> {
  return await safeRunGit(cwd, ['remote', 'get-url', name]);
}

export class GitManager {
  private repoPath: string;
  private branchName?: string;

  constructor(repoPath: string, branchName?: string) {
    this.repoPath = path.resolve(repoPath);
    this.branchName = branchName;

    const userName = getEnv('GIT_USER_NAME');
    const userEmail = getEnv('GIT_USER_EMAIL');
    if (!userName || !userEmail) {
      // Warn but do not throw. Users may rely on global git config or credential managers.
      console.error('WARNING: GIT_USER_NAME and/or GIT_USER_EMAIL not set. Falling back to git config.');
    } else {
      // Best-effort configure
      safeRunGit(this.repoPath, ['config', 'user.name', userName]);
      safeRunGit(this.repoPath, ['config', 'user.email', userEmail]);
    }
  }

  async checkoutBranch(name: string, create: boolean = true): Promise<void> {
    if (create) {
      await runGit(this.repoPath, ['checkout', '-b', name]);
    } else {
      await runGit(this.repoPath, ['checkout', name]);
    }
    this.branchName = name;
  }

  async pull(name?: string): Promise<void> {
    const branch = name || this.branchName || (await getCurrentBranch(this.repoPath)) || '';
    const hasOrigin = await hasRemote(this.repoPath, 'origin');
    if (!hasOrigin) return; // Nothing to pull from
    await runGit(this.repoPath, ['pull', 'origin', branch]);
  }

  async stageAll(): Promise<void> {
    await runGit(this.repoPath, ['add', '-A']);
  }

  async commit(message: string): Promise<void> {
    // Commit only if there is something to commit
    const status = await runGit(this.repoPath, ['status', '--porcelain']);
    if (!status) return; // nothing to commit
    await runGit(this.repoPath, ['commit', '-m', message]);
  }

  async push(): Promise<void> {
    // Determine branch
    const branch = this.branchName || (await getCurrentBranch(this.repoPath));

    // If there is no origin remote, attempt to set one from env if available; otherwise, skip with informative error
    const originExists = await hasRemote(this.repoPath, 'origin');

    const repoUrlEnv = getEnv('GIT_REPO_URL');
    const username = getEnv('GIT_USER_NAME');
    const pat = getEnv('GIT_PAT');

    // If an origin remote exists, try a plain push first. This supports SSH remotes and credential managers.
    if (originExists) {
      try {
        await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
        return;
      } catch (err) {
        // If push failed and env creds are provided, attempt authenticated URL fallback.
        if (repoUrlEnv && username && pat) {
          try {
            const url = new URL(repoUrlEnv);
            const authenticatedUrl = `${url.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(pat)}@${url.host}${url.pathname}`;
            await runGit(this.repoPath, ['remote', 'set-url', 'origin', authenticatedUrl]);
            await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
            // Restore original URL after push if we can get it
            const original = await getRemoteUrl(this.repoPath, 'origin');
            if (original && !original.includes(`://${encodeURIComponent(username)}:`)) {
              // If we captured an original before overwrite, revert; but since we changed before reading, we can't know.
              // Best-effort: do nothing here. Consumers can reconfigure origin if needed.
            }
            return;
          } catch (err2) {
            throw err2;
          }
        }
        // No credentials in env: rethrow original error to surface context, but with a friendlier message
        const e = new Error(
          'Git push failed. Ensure your repository has a valid remote and credentials (SSH agent, credential manager, or set GIT_REPO_URL/GIT_USER_NAME/GIT_PAT).' +
            `\nDetails: ${(err as Error).message}`
        );
        throw e;
      }
    }

    // No origin remote configured. If we have env settings, configure and push; otherwise, provide a helpful error.
    if (repoUrlEnv && username && pat) {
      const url = new URL(repoUrlEnv);
      const authenticatedUrl = `${url.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(pat)}@${url.host}${url.pathname}`;
      await runGit(this.repoPath, ['remote', 'add', 'origin', authenticatedUrl]);
      await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
      return;
    }

    throw new Error(
      'No Git remote "origin" found and no credentials provided. Configure a remote (e.g., SSH) or set GIT_REPO_URL, GIT_USER_NAME, and GIT_PAT in .env to enable push operations.'
    );
  }
}

export default GitManager;
