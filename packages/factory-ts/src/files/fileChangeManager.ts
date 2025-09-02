export type ChangeStatus = 'added' | 'modified' | 'deleted';

export interface DiffHunk {
  header: string; // e.g., @@ -1,3 +1,9 @@
  lines: string[]; // unified diff lines within the hunk
}

export interface FileChange {
  path: string;
  status: ChangeStatus;
  oldContent?: string;
  newContent?: string;
  diff?: string; // unified diff
  hunks?: DiffHunk[];
}

export type ProposalState = 'open' | 'partiallyAccepted' | 'accepted' | 'rejected';

export interface ProposalSummary {
  proposalId: string;
  counts: { added: number; modified: number; deleted: number; total: number };
  state: ProposalState;
  accepted: string[];
  rejected: string[];
}

export interface Proposal {
  id: string;
  projectRoot: string;
  files: Map<string, FileChange>;
  state: ProposalState;
  acceptedFiles: Set<string>;
  rejectedFiles: Set<string>;
  createdAt: number;
  updatedAt: number;
}

function simpleUnifiedDiff(oldText: string | undefined, newText: string | undefined): { diff: string; hunks: DiffHunk[] } {
  const oldLines = (oldText ?? '').split(/\r?\n/);
  const newLines = (newText ?? '').split(/\r?\n/);
  // naive line-by-line unified diff (not optimal, but deterministic and dependency-free)
  const max = Math.max(oldLines.length, newLines.length);
  const lines: string[] = [];
  const hunks: DiffHunk[] = [];
  let hunkLines: string[] = [];
  let hunkStartOld = 1;
  let hunkStartNew = 1;
  let inHunk = false;
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) {
      if (inHunk) {
        // context line
        hunkLines.push(' ' + (o ?? ''));
      }
    } else {
      if (!inHunk) {
        inHunk = true;
        hunkStartOld = i + 1;
        hunkStartNew = i + 1;
        hunkLines = [];
      }
      if (o !== undefined) hunkLines.push('-' + o);
      if (n !== undefined) hunkLines.push('+' + n);
    }
    if (inHunk && (o === n || i === max - 1)) {
      // close hunk
      const header = `@@ -${hunkStartOld},${Math.max(1, hunkLines.filter(l => l.startsWith('-') || l.startsWith(' ')).length)} +${hunkStartNew},${Math.max(1, hunkLines.filter(l => l.startsWith('+') || l.startsWith(' ')).length)} @@`;
      hunks.push({ header, lines: [...hunkLines] });
      lines.push(header, ...hunkLines);
      inHunk = false;
    }
  }
  const diff = ['--- a', '+++ b', ...lines].join('\n');
  return { diff, hunks };
}

export class FileChangeManager {
  private proposals = new Map<string, Proposal>();

  createProposal(projectRoot: string, changes: FileChange[], id?: string): Proposal {
    const pid = id ?? `proposal_${Math.random().toString(36).slice(2, 10)}`;
    const files = new Map<string, FileChange>();
    for (const ch of changes) {
      const { diff, hunks } = simpleUnifiedDiff(ch.oldContent, ch.newContent);
      files.set(ch.path, { ...ch, diff, hunks });
    }
    const now = Date.now();
    const proposal: Proposal = {
      id: pid,
      projectRoot,
      files,
      state: 'open',
      acceptedFiles: new Set(),
      rejectedFiles: new Set(),
      createdAt: now,
      updatedAt: now,
    };
    this.proposals.set(pid, proposal);
    return proposal;
  }

  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  listProposalFiles(proposalId: string): FileChange[] {
    const p = this.requireProposal(proposalId);
    return Array.from(p.files.values());
  }

  getProposalDiff(proposalId: string, filePath?: string): { files: FileChange[] } {
    const p = this.requireProposal(proposalId);
    const files = filePath ? [p.files.get(filePath)!].filter(Boolean as any) : Array.from(p.files.values());
    return { files };
  }

  acceptFiles(proposalId: string, filePaths: string[]): Proposal {
    const p = this.requireProposal(proposalId);
    for (const f of filePaths) {
      if (!p.files.has(f)) throw new Error(`File not in proposal: ${f}`);
      p.acceptedFiles.add(f);
      p.rejectedFiles.delete(f);
    }
    this.recomputeState(p);
    p.updatedAt = Date.now();
    return p;
  }

  rejectFiles(proposalId: string, filePaths: string[]): Proposal {
    const p = this.requireProposal(proposalId);
    for (const f of filePaths) {
      if (!p.files.has(f)) throw new Error(`File not in proposal: ${f}`);
      p.rejectedFiles.add(f);
      p.acceptedFiles.delete(f);
    }
    this.recomputeState(p);
    p.updatedAt = Date.now();
    return p;
  }

  discardProposal(proposalId: string): void {
    const p = this.requireProposal(proposalId);
    p.state = 'rejected';
    p.acceptedFiles.clear();
    p.rejectedFiles = new Set(Array.from(p.files.keys()));
    p.updatedAt = Date.now();
  }

  getSummary(proposalId: string): ProposalSummary {
    const p = this.requireProposal(proposalId);
    let added = 0, modified = 0, deleted = 0;
    for (const fc of p.files.values()) {
      if (fc.status === 'added') added++;
      else if (fc.status === 'modified') modified++;
      else if (fc.status === 'deleted') deleted++;
    }
    return {
      proposalId,
      state: p.state,
      counts: { added, modified, deleted, total: p.files.size },
      accepted: Array.from(p.acceptedFiles),
      rejected: Array.from(p.rejectedFiles),
    };
  }

  private recomputeState(p: Proposal) {
    const total = p.files.size;
    const accepted = p.acceptedFiles.size;
    const rejected = p.rejectedFiles.size;
    if (accepted === total && rejected === 0) p.state = 'accepted';
    else if (accepted === 0 && rejected === total) p.state = 'rejected';
    else if (accepted > 0 || rejected > 0) p.state = 'partiallyAccepted';
    else p.state = 'open';
  }

  private requireProposal(proposalId: string): Proposal {
    const p = this.proposals.get(proposalId);
    if (!p) throw new Error(`Unknown proposal: ${proposalId}`);
    return p;
  }
}

export const defaultFileChangeManager = new FileChangeManager();
