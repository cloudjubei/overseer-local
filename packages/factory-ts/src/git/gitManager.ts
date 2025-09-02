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

export class GitManager {
  private repoPath: string;
  private branchName?: string;

  constructor(repoPath: string, branchName?: string) {
    this.repoPath = path.resolve(repoPath);
    this.branchName = branchName;

    const userName = getEnv('GIT_USER_NAME');
    const userEmail = getEnv('GIT_USER_EMAIL');
    if (!userName || !userEmail) {
      // Align with Python: warn loudly but do not throw (lets consumers decide)
      console.error('ERROR: GIT_USER_NAME and GIT_USER_EMAIL must be set in your .env file.');
    } else {
      // Best-effort configure
      runGit(this.repoPath, ['config', 'user.name', userName]).catch(() => {});
      runGit(this.repoPath, ['config', 'user.email', userEmail]).catch(() => {});
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
    const branch = name || this.branchName;
    await runGit(this.repoPath, ['pull', 'origin', branch || '']);
  }

  async stageAll(): Promise<void> {
    await runGit(this.repoPath, ['add', '-A']);
  }

  async commit(message: string): Promise<void> {
    await runGit(this.repoPath, ['commit', '-m', message]);
  }

  async push(): Promise<void> {
    const repoUrl = getEnv('GIT_REPO_URL');
    const username = getEnv('GIT_USER_NAME');
    const pat = getEnv('GIT_PAT');
    const branch = this.branchName;

    if (!repoUrl || !username || !pat) {
      throw new Error('GIT_REPO_URL, GIT_USER_NAME, and GIT_PAT must be set in .env for push operations.');
    }

    // Build authenticated URL using basic auth
    // Accept repoUrl like https://github.com/owner/repo.git
    const url = new URL(repoUrl);
    const authenticatedUrl = `${url.protocol}//${encodeURIComponent(username)}:${encodeURIComponent(pat)}@${url.host}${url.pathname}`;

    // Set remote origin url to authenticated for this operation
    await runGit(this.repoPath, ['remote', 'set-url', 'origin', authenticatedUrl]);

    // Push
    await runGit(this.repoPath, ['push', '-u', 'origin', branch || '']);
  }
}

export default GitManager;
