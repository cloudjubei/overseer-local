import { EventBus, RunEvent, RunHandle, RunId } from '../events/types';
import { deepRedact, redactObject, redactString, truncateString, TruncationStrategy } from '../errors/redact';

export interface InternalRunRecord {
  runId: RunId;
  meta?: { projectId: string; taskId?: string; featureId?: string; createdAt: string; labels?: Record<string, string> };
  events: RunEvent[];
  usage?: any;
  proposals: Map<string, { summary?: any; diffs?: any[]; states?: Array<{ state: any; time?: string }> }>;
  commits: Array<{ proposalId: string; commitSha: string; message?: string; time?: string }>;
  error?: any;
  completed?: boolean;
  cancelled?: boolean;
  // internal counters for transcript caps
  _eventsBytes?: number;
}

export type RecorderLimits = {
  maxEvents?: number; // cap number of events; drop head when exceeded
  maxTotalBytes?: number; // cap total bytes of JSON-encoded events; drop head when exceeded
  maxMessageChars?: number; // cap message strings within events
  truncateStrategy?: TruncationStrategy; // how to truncate long messages
};

const DEFAULT_LIMITS: Required<RecorderLimits> = {
  maxEvents: 5000,
  maxTotalBytes: 2_000_000, // ~2MB
  maxMessageChars: 8000,
  truncateStrategy: 'middle',
};

let GLOBAL_LIMITS: Required<RecorderLimits> = { ...DEFAULT_LIMITS };

export function setRecorderLimits(limits: RecorderLimits): void {
  GLOBAL_LIMITS = { ...DEFAULT_LIMITS, ...limits } as Required<RecorderLimits>;
}

function sanitizeEvent(e: RunEvent): RunEvent {
  // Deep-redact everything
  const redacted = deepRedact(e) as RunEvent;
  // Truncate commonly large string fields safely
  const lim = GLOBAL_LIMITS;
  const applyMsg = (msg: string | undefined) => (typeof msg === 'string' ? truncateString(msg, lim.maxMessageChars, lim.truncateStrategy).text : msg);
  switch (redacted.type) {
    case 'run/progress':
      redacted.payload.message = applyMsg(redacted.payload.message) as string;
      break;
    case 'run/error':
      redacted.payload.message = applyMsg(redacted.payload.message) as string;
      if (redacted.payload.stack) redacted.payload.stack = applyMsg(redacted.payload.stack) as string;
      break;
    case 'error/retry':
      redacted.payload.error.message = applyMsg(redacted.payload.error.message) as string;
      if (redacted.payload.error.stack) redacted.payload.error.stack = applyMsg(redacted.payload.error.stack) as string;
      break;
    case 'git/commit':
      redacted.payload.message = applyMsg(redacted.payload.message) as string;
      break;
  }
  return redacted;
}

const registry = new Map<RunId, InternalRunRecord>();
const unsubscribers = new Map<RunId, () => void>();

function pushEvent(rec: InternalRunRecord, event: RunEvent) {
  const serialized = JSON.stringify(event);
  const size = Buffer.byteLength(serialized, 'utf8');
  rec._eventsBytes = (rec._eventsBytes ?? 0) + size;
  rec.events.push(event);

  // Enforce caps
  enforceCaps(rec);
}

function enforceCaps(rec: InternalRunRecord) {
  const lim = GLOBAL_LIMITS;

  // Cap by events count first
  if (rec.events.length > lim.maxEvents) {
    const toDrop = rec.events.length - lim.maxEvents;
    dropHead(rec, toDrop, 'maxEvents');
  }

  // Cap by bytes
  if ((rec._eventsBytes ?? 0) > lim.maxTotalBytes) {
    // drop until under cap (drop 10% or at least 1)
    let dropped = 0;
    const target = Math.max(0, (rec._eventsBytes ?? 0) - lim.maxTotalBytes);
    // heuristic: drop head events until bytes under cap
    while ((rec._eventsBytes ?? 0) > lim.maxTotalBytes && rec.events.length > 0) {
      const ev = rec.events[0];
      const bytes = Buffer.byteLength(JSON.stringify(ev), 'utf8');
      rec.events.shift();
      rec._eventsBytes = Math.max(0, (rec._eventsBytes ?? 0) - bytes);
      dropped++;
    }
    // insert marker event
    const marker: RunEvent = { type: 'run/truncated', runId: rec.runId, time: new Date().toISOString(), payload: { where: 'head', dropped, reason: 'maxBytes' } } as any;
    rec.events.unshift(marker);
    rec._eventsBytes = (rec._eventsBytes ?? 0) + Buffer.byteLength(JSON.stringify(marker), 'utf8');
  }
}

function dropHead(rec: InternalRunRecord, count: number, reason: 'maxEvents' | 'maxBytes') {
  let dropped = 0;
  for (let i = 0; i < count && rec.events.length > 0; i++) {
    const ev = rec.events.shift()!;
    const bytes = Buffer.byteLength(JSON.stringify(ev), 'utf8');
    rec._eventsBytes = Math.max(0, (rec._eventsBytes ?? 0) - bytes);
    dropped++;
  }
  const marker: RunEvent = { type: 'run/truncated', runId: rec.runId, time: new Date().toISOString(), payload: { where: 'head', dropped, reason } } as any;
  rec.events.unshift(marker);
  rec._eventsBytes = (rec._eventsBytes ?? 0) + Buffer.byteLength(JSON.stringify(marker), 'utf8');
}

export function attachRunRecorder(handle: RunHandle): () => void {
  const id = handle.id;
  if (!registry.has(id)) {
    registry.set(id, { runId: id, events: [], proposals: new Map(), commits: [], _eventsBytes: 0 });
  }
  const rec = registry.get(id)!;

  const unsubscribe = handle.onEvent((e: RunEvent) => {
    try {
      const se = sanitizeEvent(e);
      pushEvent(rec, se);
      switch (se.type) {
        case 'run/started':
          rec.meta = {
            projectId: se.payload.projectId,
            taskId: se.payload.taskId,
            featureId: se.payload.featureId,
            createdAt: se.time,
            labels: se.payload.meta?.labels as any,
          };
          break;
        case 'run/usage':
        case 'run/budget-exceeded':
          rec.usage = se.payload;
          break;
        case 'file/diff': {
          const p = rec.proposals.get(se.payload.proposalId) ?? {};
          p.summary = se.payload.summary;
          p.diffs = se.payload.files;
          rec.proposals.set(se.payload.proposalId, p);
          break;
        }
        case 'file/proposal-state': {
          const p = rec.proposals.get(se.payload.proposalId) ?? {};
          p.states = [...(p.states ?? []), { state: se.payload.state, time: se.time }];
          rec.proposals.set(se.payload.proposalId, p);
          break;
        }
        case 'git/commit':
          rec.commits.push({ proposalId: se.payload.proposalId, commitSha: se.payload.commitSha, message: se.payload.message, time: se.time });
          break;
        case 'run/error':
          rec.error = se.payload;
          break;
        case 'run/completed':
          rec.completed = true;
          break;
        case 'run/cancelled':
          rec.cancelled = true;
          break;
      }
    } catch {
      // keep recorder resilient
    }
  });

  unsubscribers.set(id, unsubscribe);
  return () => {
    unsubscribe();
    unsubscribers.delete(id);
  };
}

export function getRecordedRun(runId: RunId): InternalRunRecord | undefined {
  return registry.get(runId);
}

export function setImportedRun(runId: RunId, record: InternalRunRecord) {
  registry.set(runId, record);
}
