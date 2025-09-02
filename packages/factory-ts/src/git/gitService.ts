export interface CommitMetadata {
  authorName?: string;
  authorEmail?: string;
  date?: string;
}

export interface GitService {
  applyProposalToBranch(proposalId: string): Promise<void>;
  commitProposal(proposalId: string, message: string, metadata?: CommitMetadata): Promise<string>; // returns commit SHA
  revertProposal(proposalId: string): Promise<void>;
}

function randomSha(): string {
  // pseudo-random 40 hex chars
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return hex;
}

export class InMemoryGitService implements GitService {
  async applyProposalToBranch(_proposalId: string): Promise<void> {
    // no-op in-memory implementation
  }

  async commitProposal(_proposalId: string, _message: string, _metadata?: CommitMetadata): Promise<string> {
    return randomSha();
  }

  async revertProposal(_proposalId: string): Promise<void> {
    // no-op
  }
}

export const defaultGitService = new InMemoryGitService();
