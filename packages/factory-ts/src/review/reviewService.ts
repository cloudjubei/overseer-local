import { defaultFileChangeManager, FileChangeManager, ProposalSummary, FileChange } from '../files/fileChangeManager';
import { defaultGitService, GitService } from '../git/gitService';
import { defaultHistoryStore, HistoryStore, RunId } from '../db/store';

export interface ReviewOptions {
  message?: string;
  runId?: RunId;
}

export interface ListFilesResponse {
  proposalId: string;
  files: Array<{
    path: string;
    status: 'added' | 'modified' | 'deleted';
    hunks: { header: string; lines: string[] }[];
  }>
  counts: { added: number; modified: number; deleted: number; total: number };
  state: 'open' | 'partiallyAccepted' | 'accepted' | 'rejected';
}

export class ReviewService {
  constructor(
    private files: FileChangeManager = defaultFileChangeManager,
    private git: GitService = defaultGitService,
    private history: HistoryStore = defaultHistoryStore
  ) {}

  async listProposalFiles(proposalId: string): Promise<ListFilesResponse> {
    const summary = this.files.getSummary(proposalId);
    const files = this.files.listProposalFiles(proposalId).map(f => ({
      path: f.path,
      status: f.status,
      hunks: f.hunks ?? [],
    }));
    return {
      proposalId,
      files,
      counts: summary.counts,
      state: summary.state,
    };
  }

  async acceptAll(proposalId: string, opts: ReviewOptions = {}): Promise<{ commitSha: string; summary: ProposalSummary }> {
    const all = this.files.listProposalFiles(proposalId).map(f => f.path);
    this.files.acceptFiles(proposalId, all);
    await this.git.applyProposalToBranch(proposalId);
    const sha = await this.git.commitProposal(proposalId, opts.message ?? `Accept all changes for ${proposalId}`);

    const summary = this.files.getSummary(proposalId);
    await this.history.recordCommit({
      runId: opts.runId,
      proposalId,
      commitSha: sha,
      message: opts.message,
      files: all,
      counts: summary.counts,
      createdAt: Date.now(),
    });
    await this.history.updateProposalState(proposalId, 'accepted');
    return { commitSha: sha, summary };
  }

  async acceptFiles(proposalId: string, files: string[], opts: ReviewOptions = {}): Promise<{ commitSha: string; summary: ProposalSummary; accepted: string[] }> {
    this.files.acceptFiles(proposalId, files);
    await this.git.applyProposalToBranch(proposalId);
    const sha = await this.git.commitProposal(proposalId, opts.message ?? `Accept selected files for ${proposalId}`);

    const summary = this.files.getSummary(proposalId);
    await this.history.recordCommit({
      runId: opts.runId,
      proposalId,
      commitSha: sha,
      message: opts.message,
      files,
      counts: summary.counts,
      createdAt: Date.now(),
    });
    await this.history.updateProposalState(proposalId, summary.state);
    return { commitSha: sha, summary, accepted: files };
  }

  async rejectFiles(proposalId: string, files: string[], _opts: ReviewOptions = {}): Promise<{ summary: ProposalSummary; rejected: string[] }> {
    this.files.rejectFiles(proposalId, files);
    const summary = this.files.getSummary(proposalId);
    await this.history.updateProposalState(proposalId, summary.state);
    return { summary, rejected: files };
  }

  async rejectAll(proposalId: string, _opts: ReviewOptions = {}): Promise<{ summary: ProposalSummary }> {
    this.files.discardProposal(proposalId);
    const summary = this.files.getSummary(proposalId);
    await this.history.updateProposalState(proposalId, 'rejected');
    return { summary };
  }
}

// Convenience singleton instance and top-level functions
const defaultReview = new ReviewService();

export async function listProposalFiles(proposalId: string) {
  return defaultReview.listProposalFiles(proposalId);
}

export async function acceptAll(proposalId: string, opts: ReviewOptions = {}) {
  return defaultReview.acceptAll(proposalId, opts);
}

export async function acceptFiles(proposalId: string, files: string[], opts: ReviewOptions = {}) {
  return defaultReview.acceptFiles(proposalId, files, opts);
}

export async function rejectFiles(proposalId: string, files: string[], opts: ReviewOptions = {}) {
  return defaultReview.rejectFiles(proposalId, files, opts);
}

export async function rejectAll(proposalId: string, opts: ReviewOptions = {}) {
  return defaultReview.rejectAll(proposalId, opts);
}
