import { readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { deepRedact } from '../errors/redact';
import { FactoryError } from '../errors/types';
import { RunEvent } from '../events/types';
import { ExportOptions, RunArchive, RunArchiveV1 } from './types';
import { getRecordedRun } from './recorder';

function redactedEvents(events: RunEvent[], enable: boolean | undefined): RunEvent[] {
  if (!enable) return events.slice();
  return events.map(e => deepRedact(e));
}

function safeReadFile(baseDir: string, relPath: string): { encoding: 'utf8' | 'base64'; content: string; size: number } | undefined {
  try {
    const full = normalize(join(baseDir, relPath));
    const st = statSync(full);
    if (!st.isFile()) return undefined;
    const size = st.size;
    // Heuristic: if file is likely text, read as utf8; else base64
    const isText = /\.(txt|md|json|js|ts|tsx|jsx|css|html|mdx|yml|yaml|c|cpp|h|py|rb|java|go|rs|toml|ini|sh)$/i.test(relPath);
    if (isText && size <= 5_000_000) {
      const content = readFileSync(full, 'utf8');
      return { encoding: 'utf8', content, size };
    }
    const buf = readFileSync(full);
    return { encoding: 'base64', content: buf.toString('base64'), size };
  } catch {
    return undefined;
  }
}

export async function exportRun(runId: string, options: ExportOptions = {}): Promise<{ archive: RunArchive; json: string; bytes: number }>
{
  const rec = getRecordedRun(runId);
  if (!rec || !rec.meta) {
    throw new FactoryError({ code: 'VALIDATION', message: `No recorded run found for runId=${runId}` });
  }

  const version: RunArchiveV1['version'] = 'factory.run-archive.v1';

  const files: Record<string, { encoding: 'utf8' | 'base64'; content: string; size: number }> | undefined = options.includeFiles && options.baseDir
    ? {}
    : undefined;

  if (files && options.includeFiles && options.baseDir) {
    // Collect unique file paths from diffs
    const paths = new Set<string>();
    for (const [, p] of rec.proposals.entries()) {
      for (const h of p.diffs ?? []) {
        if (h.status !== 'deleted' && h.filePath) paths.add(h.filePath);
        if (h.oldPath && h.status === 'renamed') paths.add(h.oldPath);
      }
    }
    let totalBytes = 0;
    const perFileCap = options.maxFileBytes ?? 1_000_000; // 1MB per file
    for (const p of paths) {
      const snap = safeReadFile(options.baseDir, p);
      if (!snap) continue;
      if (snap.size > perFileCap) continue; // skip large files
      totalBytes += snap.size;
      files[p] = { encoding: snap.encoding, content: snap.content, size: snap.size };
      // Soft cap: avoid exploding archive due to many files
      if (totalBytes > (options.maxBytes ?? 25_000_000)) break;
    }
  }

  const events = redactedEvents(rec.events, options.redactSecrets ?? true);

  const archive: RunArchiveV1 = {
    version,
    meta: {
      runId: rec.runId,
      projectId: rec.meta.projectId,
      taskId: rec.meta.taskId,
      featureId: rec.meta.featureId,
      createdAt: rec.meta.createdAt,
      labels: rec.meta.labels,
    },
    usage: rec.usage,
    events,
    proposals: Array.from(rec.proposals.entries()).map(([proposalId, p]) => ({ proposalId, summary: p.summary, diffs: p.diffs, states: p.states })),
    commits: rec.commits.slice(),
    files,
    stats: { events: events.length, files: files ? Object.keys(files).length : undefined },
    createdAt: new Date().toISOString(),
  };

  const json = JSON.stringify(archive, null, options.pretty ? 2 : undefined);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (options.maxBytes && bytes > options.maxBytes) {
    throw new FactoryError({ code: 'VALIDATION', message: `Archive exceeds size limit (${bytes} > ${options.maxBytes} bytes)` });
  }
  (archive as any).stats.bytes = bytes;
  return { archive, json, bytes };
}
