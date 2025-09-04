import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

// Best-effort dotenv loader that reads a .env from repoPath (and optionally its parent)
function loadDotenv(repoPath: string) {
  try {
    // Lazy require dotenv to avoid bundling if not needed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dotenv = require('dotenv') as typeof import('dotenv');
    const candidates = [
      path.join(repoPath, '.env'),
      path.join(path.dirname(repoPath), '.env'),
    ];
    for (const file of candidates) {
      if (fs.existsSync(file)) {
        dotenv.config({ path: file });
        break; // first match wins
      }
    }
  } catch {
    // If dotenv isn't available or fails, ignore silently
  }
}

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

function normalizeCreds() {
  // Accept multiple token/user env var options
  const repoUrl = getEnv('GIT_REPO_URL') || getEnv('REPOSITORY_URL') || getEnv('REPO_URL');
  const username = getEnv('GIT_USER_NAME') || getEnv('GIT_USERNAME') || getEnv('GITHUB_USERNAME');
  const token = getEnv('GIT_PAT') || getEnv('GIT_TOKEN') || getEnv('GITHUB_TOKEN') || getEnv('GH_TOKEN');
  const email = getEnv('GIT_USER_EMAIL') || getEnv('GIT_EMAIL') || getEnv('GITHUB_EMAIL');
  return { repoUrl, username, token, email };
}

function buildHttpsUrlWithToken(repoUrl: string, username: string, token: string): string {
  try {
    const url = new URL(repoUrl);
    // Only inject credentials for https protocol
    if (!/^https?:$/.test(url.protocol)) return repoUrl;
    return `${url.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(token)}@${url.host}${url.pathname}`;
  } catch {
    return repoUrl;
  }
}

function httpsToSsh(repoUrl: string): string | undefined {
  try {
    const url = new URL(repoUrl);
    if (url.protocol.startsWith('http')) {
      const pathname = url.pathname.replace(/^\//, '');
      return `git@${url.host}:${pathname}`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export class GitManager {
  private repoPath: string;
  private branchName?: string;

  constructor(repoPath: string, branchName?: string) {
    this.repoPath = path.resolve(repoPath);
    this.branchName = branchName;

    // Load .env from repo to populate process.env if the host hasn't loaded it.
    loadDotenv(this.repoPath);

    const { username, email } = normalizeCreds();
    const userName = username || getEnv('GIT_USER_NAME');
    const userEmail = email || getEnv('GIT_USER_EMAIL');
    if (!userName || !userEmail) {
      // Warn but do not throw. Users may rely on global git config or credential managers.
      console.error('WARNING: Git user.name and/or user.email not provided via env. Falling back to git global config.');
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

    // Ensure .env is loaded before checking env vars (in case push() is called later)
    loadDotenv(this.repoPath);
    const { repoUrl, username, token } = normalizeCreds();

    // If there is no origin remote, attempt to set one from env if available; otherwise, skip with informative error
    const originExists = await hasRemote(this.repoPath, 'origin');

    // If an origin remote exists, try a plain push first. This supports SSH remotes and credential managers.
    if (originExists) {
      try {
        await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
        return;
      } catch (err) {
        // If push failed, attempt a staged fallback strategy
        // 1) If we have HTTPS repo URL and token creds, try embedding credentials.
        if (repoUrl && username && token) {
          try {
            const authenticatedUrl = buildHttpsUrlWithToken(repoUrl, username, token);
            await runGit(this.repoPath, ['remote', 'set-url', 'origin', authenticatedUrl]);
            await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
            return;
          } catch (err2) {
            // 2) If https failed, and the remote is https, try converting to SSH and pushing (SSH agent may be available)
            try {
              const sshUrl = httpsToSsh(repoUrl || (await getRemoteUrl(this.repoPath, 'origin')) || '');
              if (sshUrl) {
                await runGit(this.repoPath, ['remote', 'set-url', 'origin', sshUrl]);
                await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
                return;
              }
            } catch {
              // ignore
            }
            // rethrow deepest err
            throw err2;
          }
        }
        // 2) Without creds, if current origin is https, try switching to SSH (if possible)
        try {
          const currentUrl = await getRemoteUrl(this.repoPath, 'origin');
          const sshUrl = currentUrl ? httpsToSsh(currentUrl) : undefined;
          if (sshUrl) {
            await runGit(this.repoPath, ['remote', 'set-url', 'origin', sshUrl]);
            await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
            return;
          }
        } catch {
          // ignore
        }

        // No credentials in env and no SSH fallback worked: rethrow with a friendlier message
        const e = new Error(
          'Git push failed. Ensure your repository has a valid remote and authentication (SSH agent, credential manager, or set GIT_REPO_URL + GIT_USER_NAME + GIT_PAT / GIT_TOKEN / GITHUB_TOKEN in .env).\n' +
            `Details: ${(err as Error).message}`
        );
        throw e;
      }
    }

    // No origin remote configured. If we have env settings, configure and push; otherwise, provide a helpful error.
    if (repoUrl && username && token) {
      const authenticatedUrl = buildHttpsUrlWithToken(repoUrl, username, token);
      await runGit(this.repoPath, ['remote', 'add', 'origin', authenticatedUrl]);
      await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
      return;
    }

    // If repoUrl exists but token missing, try adding SSH origin from https URL
    if (repoUrl) {
      const sshUrl = httpsToSsh(repoUrl);
      if (sshUrl) {
        await runGit(this.repoPath, ['remote', 'add', 'origin', sshUrl]);
        try {
          await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
          return;
        } catch {
          // fall-through to error below
        }
      }
    }

    throw new Error(
      'No Git remote "origin" found and no usable credentials provided. Configure a remote (e.g., SSH) or set GIT_REPO_URL along with GIT_USER_NAME and a token (GIT_PAT/GIT_TOKEN/GITHUB_TOKEN) in a .env at the repo root to enable push operations.'
    );
  }
}

export default GitManager;
