import { RunEvent, RunId, UsagePayload, FileDiffHunk, FileChangeSummary } from '../events/types';

export type ArchiveVersion = 'factory.run-archive.v1';

export interface RunMeta {
  runId: RunId;
  projectId: string;
  taskId?: string;
  featureId?: string;
  createdAt: string; // ISO
  labels?: Record<string, string>;
}

export interface ProposalSnapshot {
  proposalId: string;
  summary?: FileChangeSummary;
  diffs?: FileDiffHunk[];
  states?: Array<{ state: 'open' | 'accepted' | 'rejected' | 'partial'; time?: string }>;
}

export interface CommitSnapshot {
  proposalId: string;
  commitSha: string;
  message?: string;
  time?: string;
}

export interface FileSnapshotEntry {
  encoding: 'utf8' | 'base64';
  size: number;
  content: string; // utf8 or base64 encoded
}

export interface RunArchiveV1 {
  version: ArchiveVersion;
  meta: RunMeta;
  usage?: UsagePayload;
  events: RunEvent[];
  proposals?: ProposalSnapshot[];
  commits?: CommitSnapshot[];
  files?: Record<string, FileSnapshotEntry>; // relative to project root
  stats: { events: number; files?: number; bytes?: number };
  createdAt: string; // ISO: when archive was created
}

export type RunArchive = RunArchiveV1;

export interface ExportOptions {
  includeFiles?: boolean;
  baseDir?: string; // project root for file snapshots
  maxBytes?: number; // hard cap on resulting JSON size
  redactSecrets?: boolean; // default true
  pretty?: boolean; // default false
  maxFileBytes?: number; // cap per file when snapshotting
}

export interface ImportedRun {
  runId: RunId;
  archive: RunArchive;
  replay: (sink: { emit: (e: RunEvent) => void } | ((e: RunEvent) => void)) => void;
}
