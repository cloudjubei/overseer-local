// Simple renderer-side wrapper; calls through preload exposed API

type MergeOptions = {
  targetBranch?: string;
  ffOnly?: boolean;
  squash?: boolean;
  noCommit?: boolean;
  allowUnrelated?: boolean;
  push?: boolean;
};

export function mergeTaskBranch(projectId: string, taskId: string, options: MergeOptions = {}) {
  // @ts-ignore - injected by preload
  return window.gitService.mergeTaskBranch(projectId, taskId, options);
}

export function listFeatureBranches(projectId: string) {
  // @ts-ignore - injected by preload
  return window.gitService.listFeatureBranches(projectId);
}
