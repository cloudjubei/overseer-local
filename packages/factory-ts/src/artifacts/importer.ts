import { readFileSync } from 'node:fs';
import { RunEvent, EventBus } from '../events/types';
import { FactoryError } from '../errors/types';
import { ImportedRun, RunArchive, RunArchiveV1 } from './types';
import { setImportedRun } from './recorder';

function isRunArchiveV1(obj: any): obj is RunArchiveV1 {
  return obj && obj.version === 'factory.run-archive.v1' && obj.meta && Array.isArray(obj.events);
}

export async function importRun(filePath: string): Promise<ImportedRun> {
  let data: string;
  try {
    data = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new FactoryError({ code: 'IO', message: `Failed to read archive at ${filePath}`, cause: err });
  }
  let parsed: RunArchive;
  try {
    parsed = JSON.parse(data);
  } catch (err) {
    throw new FactoryError({ code: 'VALIDATION', message: 'Archive is not valid JSON', cause: err });
  }
  if (!isRunArchiveV1(parsed)) {
    throw new FactoryError({ code: 'VALIDATION', message: `Unsupported or invalid archive version: ${(parsed as any)?.version}` });
  }

  // Store a minimal record for later retrieval/export replay if needed
  setImportedRun(parsed.meta.runId, {
    runId: parsed.meta.runId,
    meta: {
      projectId: parsed.meta.projectId,
      taskId: parsed.meta.taskId,
      featureId: parsed.meta.featureId,
      createdAt: parsed.meta.createdAt,
      labels: parsed.meta.labels,
    },
    events: parsed.events,
    proposals: new Map((parsed.proposals ?? []).map(p => [p.proposalId, { summary: p.summary, diffs: p.diffs, states: p.states }])),
    commits: parsed.commits ?? [],
  });

  const imported: ImportedRun = {
    runId: parsed.meta.runId,
    archive: parsed,
    replay: (sink: { emit: (e: RunEvent) => void } | ((e: RunEvent) => void)) => {
      const emit = typeof sink === 'function' ? sink : (e: RunEvent) => sink.emit(e);
      for (const e of parsed.events) emit(e);
    },
  };
  return imported;
}
