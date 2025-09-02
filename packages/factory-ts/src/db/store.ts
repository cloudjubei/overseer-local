import { getConfig } from '../config';
import { ProposalState } from '../events';

export type RunId = string;
export type ProposalId = string;

export interface CommitRecord {
  runId?: RunId;
  proposalId: ProposalId;
  commitSha: string;
  message?: string;
  files: string[];
  counts: { added: number; modified: number; deleted: number; total: number };
  createdAt: number;
}

export interface HistoryStore {
  recordCommit(rec: CommitRecord): Promise<void>;
  updateProposalState(proposalId: ProposalId, state: ProposalState): Promise<void>;
  getCommitsByProposal(proposalId: ProposalId): Promise<CommitRecord[]>;
}

export class InMemoryHistoryStore implements HistoryStore {
  private commits: CommitRecord[] = [];
  private proposalStates = new Map<ProposalId, ProposalState>();

  async recordCommit(rec: CommitRecord): Promise<void> {
    this.commits.push(rec);
  }

  async updateProposalState(proposalId: ProposalId, state: ProposalState): Promise<void> {
    this.proposalStates.set(proposalId, state);
  }

  async getCommitsByProposal(proposalId: ProposalId): Promise<CommitRecord[]> {
    return this.commits.filter(c => c.proposalId === proposalId);
  }
}

// Default store remains in-memory for now. Consumers should acquire a store from
// createHistoryStore() so config can later swap implementations (e.g., SQLite).
export function createHistoryStore(): HistoryStore {
  const cfg = getConfig();
  // Placeholder: when a SQLite-backed store is introduced, use cfg.paths.dbPath here.
  void cfg; // avoid unused warning
  return new InMemoryHistoryStore();
}

export const defaultHistoryStore = createHistoryStore();
