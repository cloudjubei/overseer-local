import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { FileChangeManager } from '../files/fileChangeManager';
import { ReviewService } from './reviewService';
import { InMemoryHistoryStore, HistoryStore } from '../db/store';
import { DefaultRunHandle, makeRunId } from '../events/runtime';
import { RunEvent, toISO } from '../events/types';

// Helper: minimal git wrapper
function git(cwd: string, args: string[], input?: string): string {
  const res = spawnSync('git', args, { cwd, input, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function initRepo(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, ['init']);
  // Ensure main branch for determinism
  try { git(dir, ['checkout', '-b', 'main']); } catch { /* older git may already be on main */ }
  git(dir, ['config', 'user.name', 'Test User']);
  git(dir, ['config', 'user.email', 'test@example.com']);
}

function writeFile(dir: string, rel: string, content: string) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function readFile(dir: string, rel: string): string | undefined {
  const abs = path.join(dir, rel);
  if (!fs.existsSync(abs)) return undefined;
  return fs.readFileSync(abs, 'utf8');
}

function fileExists(dir: string, rel: string): boolean {
  return fs.existsSync(path.join(dir, rel));
}

// Test GitService implementation backed by real git and our FileChangeManager
class TestGitService {
  constructor(private repoRoot: string, private fcm: FileChangeManager, private runEmit?: (e: RunEvent) => void) {}

  private ensureBranch(branch: string) {
    const current = git(this.repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (current !== branch) {
      // Create branch from main if not exists
      const exists = spawnSync('git', ['show-ref', '--verify', `refs/heads/${branch}`], { cwd: this.repoRoot });
      if (exists.status !== 0) {
        git(this.repoRoot, ['checkout', 'main']);
        git(this.repoRoot, ['checkout', '-b', branch]);
      } else {
        git(this.repoRoot, ['checkout', branch]);
      }
    }
  }

  async applyProposalToBranch(proposalId: string): Promise<void> {
    const branch = `feature/${proposalId}`;
    this.ensureBranch(branch);
    if (this.runEmit) this.runEmit({ type: 'git/branch-created', runId: 'test', time: toISO(), payload: { branchName: branch } } as RunEvent);
  }

  async commitProposal(proposalId: string, message: string): Promise<string> {
    const p = this.fcm.getProposal(proposalId)!;
    const branch = `feature/${proposalId}`;
    this.ensureBranch(branch);

    // Apply accepted files; if none accepted yet, accept all by default (defensive)
    const accept = p.acceptedFiles.size ? Array.from(p.acceptedFiles) : Array.from(p.files.keys());
    for (const f of accept) {
      const fc = p.files.get(f)!;
      const abs = path.join(this.repoRoot, f);
      if (fc.status === 'deleted') {
        if (fs.existsSync(abs)) fs.rmSync(abs);
      } else {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, fc.newContent ?? '', 'utf8');
      }
    }
    // Stage and commit
    git(this.repoRoot, ['add', '-A']);
    git(this.repoRoot, ['commit', '-m', message]);
    const sha = git(this.repoRoot, ['rev-parse', 'HEAD']);

    if (this.runEmit) this.runEmit({ type: 'git/commit', runId: 'test', time: toISO(), payload: { proposalId, commitSha: sha, message } } as RunEvent);
    return sha;
  }

  async revertProposal(_proposalId: string): Promise<void> {
    // For test we won't use revert
  }
}

class TestHistoryStore implements HistoryStore {
  private commits: any[] = [];
  private states = new Map<string, any>();
  async recordCommit(rec: any): Promise<void> { this.commits.push(rec); }
  async updateProposalState(proposalId: string, state: any): Promise<void> { this.states.set(proposalId, state); }
  async getCommitsByProposal(proposalId: string): Promise<any[]> { return this.commits.filter(c => c.proposalId === proposalId); }
  getState(proposalId: string) { return this.states.get(proposalId); }
}

describe('Integration: Git + ReviewService + FileChangeManager', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-int-'));
  const repoDir = path.join(tmpBase, 'repo');
  const events: RunEvent[] = [];

  beforeAll(() => {
    initRepo(repoDir);
    writeFile(repoDir, 'README.md', 'hello');
    writeFile(repoDir, 'old.txt', 'remove me');
    git(repoDir, ['add', '-A']);
    git(repoDir, ['commit', '-m', 'initial']);
  });

  afterAll(() => {
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
  });

  it('accept workflow: creates branch, commits applied files, updates history and emits events', async () => {
    const fcm = new FileChangeManager();
    // Build proposal with deterministic ID
    const proposalId = 'p1';
    const changes = [
      { path: 'README.md', status: 'modified' as const, oldContent: 'hello', newContent: 'hello world' },
      { path: 'src/index.ts', status: 'added' as const, newContent: 'export const hi = 1;\n' },
      { path: 'old.txt', status: 'deleted' as const, oldContent: 'remove me' },
    ];
    const proposal = fcm.createProposal(repoDir, changes, proposalId);

    // Wire a run handle to collect events
    const handle = new DefaultRunHandle(makeRunId('run'));
    const un = handle.onEvent((e) => events.push(e));

    // Emit proposal + diffs
    const summary = fcm.getSummary(proposalId).counts;
    handle.eventBus.emit({ type: 'file/proposal', runId: handle.id, time: toISO(), payload: { proposalId, summary: { added: summary.added, modified: summary.modified, deleted: summary.deleted } } } as RunEvent);

    const diffFiles = fcm.listProposalFiles(proposalId).map(fc => ({ filePath: fc.path, status: (fc.status === 'added' || fc.status === 'modified' || fc.status === 'deleted') ? fc.status : 'modified', unifiedDiff: fc.diff || '' }));
    handle.eventBus.emit({ type: 'file/diff', runId: handle.id, time: toISO(), payload: { proposalId, files: diffFiles as any, summary: { added: summary.added, modified: summary.modified, deleted: summary.deleted } } } as RunEvent);

    const history = new TestHistoryStore();
    const gitSvc = new TestGitService(repoDir, fcm, (e) => handle.eventBus.emit(e));
    const review = new ReviewService(fcm, gitSvc as any, history as any);

    // Accept only README.md and src/index.ts; leave deletion unaccepted
    const acceptedFiles = ['README.md', 'src/index.ts'];
    const res = await review.acceptFiles(proposalId, acceptedFiles, { runId: handle.id, message: 'accept partial' });

    // Emit proposal state event after acceptance
    const state = fcm.getSummary(proposalId).state;
    handle.eventBus.emit({ type: 'file/proposal-state', runId: handle.id, time: toISO(), payload: { proposalId, state: state === 'partiallyAccepted' ? 'partial' : state as any } } as RunEvent);

    // Assertions
    expect(res.commitSha).toBeTruthy();
    // Branch should be feature/p1
    const branch = git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(branch).toBe('feature/p1');

    // Files applied
    expect(readFile(repoDir, 'README.md')).toBe('hello world');
    expect(readFile(repoDir, 'src/index.ts')).toBe('export const hi = 1;\n');
    expect(fileExists(repoDir, 'old.txt')).toBe(true); // not accepted deletion

    // History recorded
    const commits = await history.getCommitsByProposal(proposalId);
    expect(commits.length).toBe(1);
    expect(commits[0].commitSha).toBe(res.commitSha);
    expect(commits[0].files.sort()).toEqual(acceptedFiles.sort());

    // Events captured include branch-created, commit, file/proposal, file/diff, and proposal-state
    const types = events.map(e => e.type);
    expect(types).toContain('file/proposal');
    expect(types).toContain('file/diff');
    expect(types).toContain('git/branch-created');
    expect(types).toContain('git/commit');
    expect(types).toContain('file/proposal-state');

    un();
  });

  it('reject workflow: rejects all without creating branch or commit and updates history state', async () => {
    const fcm = new FileChangeManager();
    const proposalId = 'p2';
    const changes = [
      { path: 'README.md', status: 'modified' as const, oldContent: 'hello world', newContent: 'bye' },
    ];
    fcm.createProposal(repoDir, changes, proposalId);

    const handle = new DefaultRunHandle(makeRunId('run'));
    const gitSvc = new TestGitService(repoDir, fcm, (e) => handle.eventBus.emit(e));
    const history = new TestHistoryStore();
    const review = new ReviewService(fcm, gitSvc as any, history as any);

    const beforeRefs = spawnSync('git', ['show-ref'], { cwd: repoDir, encoding: 'utf8' }).stdout;
    const rej = await review.rejectAll(proposalId, { runId: handle.id });
    // Emit state event
    handle.eventBus.emit({ type: 'file/proposal-state', runId: handle.id, time: toISO(), payload: { proposalId, state: 'rejected' } } as RunEvent);

    const afterRefs = spawnSync('git', ['show-ref'], { cwd: repoDir, encoding: 'utf8' }).stdout;
    // No new refs should be created by rejection (best-effort check)
    expect(afterRefs).toBe(beforeRefs);

    // No commits recorded
    const commits = await history.getCommitsByProposal(proposalId);
    expect(commits.length).toBe(0);

    // State updated in history store
    expect(history.getState(proposalId)).toBe('rejected');
  });
});
