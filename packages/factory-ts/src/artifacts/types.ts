import type { RunEvent } from '../events/types';

export type RunArchiveVersion = 'factory.run-archive.v1';

export interface ProposalArchiveEntry {
  proposalId: string;
  summary?: any;
  diffs?: any[];
  states?: Array<{ state: any; time?: string }>;
}

export interface CommitArchiveEntry {
  proposalId: string;
  commitSha: string;
  message?: string;
  time?: string;
}

export interface RunArchiveV1 {
  version: RunArchiveVersion;
  meta: {
    runId: string;
    projectId: string;
    taskId?: string;
    featureId?: string;
    createdAt: string;
    labels?: Record<string, string>;
  };
  usage?: any;
  events: RunEvent[];
  proposals: ProposalArchiveEntry[];
  commits: CommitArchiveEntry[];
  files?: Record<string, { encoding: 'utf8' | 'base64'; content: string; size: number }>;
  stats?: { events: number; files?: number; bytes?: number };
  createdAt: string;
}

export type RunArchive = RunArchiveV1;

export interface ExportOptions {
  includeFiles?: boolean;
  baseDir?: string;
  maxBytes?: number;
  maxFileBytes?: number;
  pretty?: boolean;
  redactSecrets?: boolean;
}
