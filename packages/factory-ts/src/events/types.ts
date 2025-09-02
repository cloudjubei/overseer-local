/*
 * Serializable event types and RunHandle interfaces suitable for IPC.
 */

export type RunId = string;
export type Timestamp = string; // ISO string for IPC-safe serialization

export type EventBase<T extends string> = {
  type: T;
  time: Timestamp;
  runId: RunId;
};

export type ErrorPayload = {
  message: string;
  name?: string;
  code?: string;
  stack?: string; // May be redacted/truncated
  data?: Record<string, unknown>;
};

export type UsagePayload = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUSD?: number;
};

export type FileChangeSummary = {
  added: number;
  modified: number;
  deleted: number;
};

export type FileDiffHunk = {
  filePath: string;            // normalized relative to project root
  oldPath?: string;            // for renames
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  unifiedDiff: string;         // unified diff text
};

export type ProposalState = 'open' | 'accepted' | 'rejected' | 'partial';

export type RunEvent =
  | (EventBase<'run/started'> & { payload: { taskId?: string; featureId?: string; projectId: string; meta?: Record<string, unknown>; } })
  | (EventBase<'run/progress'> & { payload: { message: string; step?: string; progress?: number; usage?: UsagePayload; } })
  | (EventBase<'run/progress/snapshot'> & { payload: { message: string; step?: string; progress?: number; usage?: UsagePayload; } })
  | (EventBase<'run/usage'> & { payload: UsagePayload })
  | (EventBase<'run/budget-exceeded'> & { payload: UsagePayload })
  | (EventBase<'run/error'> & { payload: ErrorPayload })
  | (EventBase<'error/retry'> & { payload: { error: ErrorPayload; attempt: number; nextDelayMs: number; } })
  | (EventBase<'file/proposal'> & { payload: { proposalId: string; title?: string; summary?: FileChangeSummary; } })
  | (EventBase<'file/diff'> & { payload: { proposalId: string; files: FileDiffHunk[]; summary: FileChangeSummary; } })
  | (EventBase<'file/proposal-state'> & { payload: { proposalId: string; state: ProposalState; } })
  | (EventBase<'git/branch-created'> & { payload: { branchName: string; base?: string; } })
  | (EventBase<'git/commit'> & { payload: { proposalId: string; commitSha: string; message: string; } })
  | (EventBase<'run/truncated'> & { payload: { where: 'head' | 'tail'; dropped: number; reason: 'maxEvents' | 'maxBytes'; } })
  | (EventBase<'run/completed'> & { payload: { success: boolean; usage?: UsagePayload; message?: string; } })
  | (EventBase<'run/cancelled'> & { payload: { reason?: string; } });

export type RunEventType = RunEvent['type'];

export interface RunEventListener {
  (event: RunEvent): void;
}

export interface EventBus {
  emit(event: RunEvent): void;
  on(listener: RunEventListener): () => void; // returns unsubscribe
}

export interface RunHandle {
  id: RunId;
  onEvent: (listener: RunEventListener) => () => void;
  cancel: (reason?: string) => void;
  isCancelled: () => boolean;
}

export type JsonlEncoder = (e: RunEvent) => string;

export function toISO(date: Date = new Date()): Timestamp {
  return date.toISOString();
}
