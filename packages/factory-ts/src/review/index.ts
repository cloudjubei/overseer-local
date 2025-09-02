import { FileChangeManager } from '../files/fileChangeManager';
import { SandboxOverlay } from '../files/sandboxOverlay';
import { defaultHistoryStore } from '../db/store';
import { defaultGitService } from '../git/gitService';

export function createReviewService(opts: { overlay: SandboxOverlay; fcm: FileChangeManager }) {
  const { overlay, fcm } = opts;
  return {
    async acceptAll(proposalId: string) {
      const files = fcm.listProposalFiles(proposalId).map((f) => f.path);
      await overlay.acceptFiles(files);
    },
    async acceptFiles(proposalId: string, files: string[]) {
      await overlay.acceptFiles(files);
    },
    async rejectAll(_proposalId: string) {
      await overlay.rejectAll();
    },
    async rejectFiles(_proposalId: string, files: string[]) {
      // noop to overlay; simply not applying specific files works as rejection semantics here
      void files;
    },
    async finalize(proposalId: string, message?: string) {
      // Apply and commit using in-memory git service
      await defaultGitService.applyProposalToBranch(proposalId);
      const sha = await defaultGitService.commitProposal(proposalId, message ?? `Accept proposal ${proposalId}`);
      await defaultHistoryStore.recordCommit({
        proposalId,
        commitSha: sha,
        message,
        files: fcm.listProposalFiles(proposalId).map((f) => f.path),
        counts: fcm.getSummary(proposalId).counts,
        createdAt: Date.now(),
      });
      return { commitSha: sha };
    },
  };
}

export type ReviewService = ReturnType<typeof createReviewService>;
