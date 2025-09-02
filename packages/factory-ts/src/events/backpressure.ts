import { EventBus, RunEvent, RunEventListener, RunId, toISO } from './types';

export type DropStrategy = 'drop-oldest' | 'drop-newest' | 'coalesce';

export interface CoalesceRule {
  types: RunEvent['type'][];
  windowMs: number; // within this window, coalesce to last event
  reducer?: (prev: RunEvent | undefined, next: RunEvent) => RunEvent; // optional custom reduction
}

export interface BackpressureConfig {
  maxQueueSize: number; // max number of events waiting to flush
  maxQueueBytes: number; // max total bytes of queued events
  flushIntervalMs: number; // periodic flush cadence
  dropStrategy: DropStrategy;
  coalesce?: CoalesceRule[];
  insertTruncationMarker?: boolean; // when dropping, insert run/truncated marker
}

const DEFAULT_CFG: BackpressureConfig = {
  maxQueueSize: 1000,
  maxQueueBytes: 500_000,
  flushIntervalMs: 16, // ~60fps batches
  dropStrategy: 'coalesce',
  coalesce: [
    {
      types: ['run/progress', 'run/usage'],
      windowMs: 50,
      reducer: (prev, next) => next, // keep last within window
    },
  ],
  insertTruncationMarker: true,
};

function eventBytes(e: RunEvent): number {
  try { return Buffer.byteLength(JSON.stringify(e), 'utf8'); } catch { return 0; }
}

export class BufferedEventBus implements EventBus {
  private listeners = new Set<RunEventListener>();
  private downstream?: EventBus; // optional chain to another bus
  private cfg: BackpressureConfig;
  private queue: RunEvent[] = [];
  private queueBytes = 0;
  private timer: NodeJS.Timeout | null = null;
  private lastEmitByType = new Map<RunEvent['type'], number>();

  constructor(cfg?: Partial<BackpressureConfig>, downstream?: EventBus) {
    this.cfg = { ...DEFAULT_CFG, ...(cfg ?? {}) };
    this.downstream = downstream;
  }

  on(listener: RunEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: RunEvent): void {
    // Stage into queue with coalescing
    this.enqueue(event);
    this.ensureScheduled();
  }

  private enqueue(e: RunEvent) {
    const bytes = eventBytes(e);
    const now = Date.now();

    // Try coalescing
    const rule = this.cfg.coalesce?.find(r => r.types.includes(e.type));
    if (rule) {
      const lastIdx = this.findLastIndex(rule.types);
      if (lastIdx !== -1) {
        const last = this.queue[lastIdx];
        const lastTime = this.lastEmitByType.get(last.type) ?? 0;
        if (now - lastTime <= rule.windowMs) {
          // replace with reduced event
          const reduced = rule.reducer ? rule.reducer(last, e) : e;
          // adjust bytes accounting
          this.queueBytes -= eventBytes(last);
          this.queue[lastIdx] = reduced;
          this.queueBytes += eventBytes(reduced);
          this.lastEmitByType.set(reduced.type, now);
          this.boundQueue();
          return;
        }
      }
    }

    this.queue.push(e);
    this.queueBytes += bytes;
    this.lastEmitByType.set(e.type, now);
    this.boundQueue();
  }

  private findLastIndex(types: RunEvent['type'][]): number {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (types.includes(this.queue[i].type)) return i;
    }
    return -1;
  }

  private boundQueue() {
    const cfg = this.cfg;

    if (this.queue.length <= cfg.maxQueueSize && this.queueBytes <= cfg.maxQueueBytes) return;

    let dropped = 0;
    const reason: 'maxEvents' | 'maxBytes' = this.queue.length > cfg.maxQueueSize ? 'maxEvents' : 'maxBytes';

    if (cfg.dropStrategy === 'drop-newest') {
      while ((this.queue.length > cfg.maxQueueSize) || (this.queueBytes > cfg.maxQueueBytes)) {
        const ev = this.queue.pop();
        if (!ev) break;
        this.queueBytes -= eventBytes(ev);
        dropped++;
      }
    } else if (cfg.dropStrategy === 'drop-oldest') {
      while ((this.queue.length > cfg.maxQueueSize) || (this.queueBytes > cfg.maxQueueBytes)) {
        const ev = this.queue.shift();
        if (!ev) break;
        this.queueBytes -= eventBytes(ev);
        dropped++;
      }
    } else {
      // coalesce strategy: aggressively remove older progress/usage first, then oldest
      const removableTypes: RunEvent['type'][] = ['run/progress', 'run/usage'];
      let i = 0;
      while ((this.queue.length > cfg.maxQueueSize) || (this.queueBytes > cfg.maxQueueBytes)) {
        // find earliest removable type
        let idx = this.queue.findIndex(ev => removableTypes.includes(ev.type));
        if (idx === -1) idx = 0; // fall back to drop head
        const ev = this.queue.splice(idx, 1)[0];
        this.queueBytes -= eventBytes(ev);
        dropped++;
        if (i++ > 10_000) break; // safety
      }
    }

    if (cfg.insertTruncationMarker && dropped > 0) {
      const runId = this.peekRunId();
      const marker: any = { type: 'run/truncated', runId: runId ?? 'unknown', time: toISO(), payload: { where: 'head', dropped, reason } };
      this.queue.unshift(marker as RunEvent);
      this.queueBytes += eventBytes(marker as RunEvent);
    }
  }

  private ensureScheduled() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.cfg.flushIntervalMs);
  }

  private flush() {
    this.timer = null;
    if (this.queue.length === 0) return;

    const batch = this.queue.splice(0, this.queue.length);
    this.queueBytes = 0;

    // Deliver batch to local listeners first
    for (const ev of batch) {
      for (const l of Array.from(this.listeners)) {
        try { l(ev); } catch { /* swallow */ }
      }
      // Chain downstream if provided
      if (this.downstream) {
        try { this.downstream.emit(ev); } catch { /* swallow */ }
      }
    }
  }

  // Utility: create a periodic progress snapshotter that emits at most every intervalMs
  static withProgressSnapshots(bus: EventBus, intervalMs = 250): EventBus {
    const buffered = new BufferedEventBus({}, bus);
    let lastSnapshot = 0;
    let pending: RunEvent | null = null;

    buffered.on((e) => {
      if (e.type === 'run/progress') {
        pending = e; // keep last seen
        const now = Date.now();
        if (now - lastSnapshot >= intervalMs) {
          lastSnapshot = now;
          const snap: RunEvent = { ...e, type: 'run/progress/snapshot' as any };
          // emit snapshot immediately (enqueue so batching still applies)
          buffered.emit(snap);
          pending = null;
        }
      }
    });

    // Also schedule a trailing snapshot if events are quiet
    const timer = setInterval(() => {
      if (pending) {
        const snap: RunEvent = { ...pending, type: 'run/progress/snapshot' as any };
        buffered.emit(snap);
        pending = null;
      }
    }, Math.max(100, intervalMs));

    // Consumers should clear interval when no longer needed; omitted for simplicity
    return buffered;
  }
}

// JSONL stream with bounded in-memory buffer and backpressure-aware dropping
export function streamJSONLBuffered(source: { on: (fn: RunEventListener) => () => void }, cfg?: { maxBufferedLines?: number; maxBufferedBytes?: number }): AsyncGenerator<string> {
  const maxLines = cfg?.maxBufferedLines ?? 2000;
  const maxBytes = cfg?.maxBufferedBytes ?? 1_000_000; // 1MB
  let queue: string[] = [];
  let qBytes = 0;
  let resolve: (() => void) | null = null;
  let done = false;

  const wake = () => { if (resolve) { const r = resolve; resolve = null; r(); } };

  const unsub = source.on((e) => {
    try {
      const line = JSON.stringify(e) + '\n';
      const bytes = Buffer.byteLength(line, 'utf8');
      queue.push(line);
      qBytes += bytes;
      // Truncate queue if overflowing
      let dropped = 0;
      while (queue.length > maxLines || qBytes > maxBytes) {
        const s = queue.shift();
        if (!s) break;
        qBytes -= Buffer.byteLength(s, 'utf8');
        dropped++;
      }
      if (dropped > 0) {
        const marker = JSON.stringify({ type: 'run/truncated', time: toISO(), runId: (e as any).runId ?? 'unknown', payload: { where: 'head', dropped: dropped, reason: queue.length > maxLines ? 'maxEvents' : 'maxBytes' } }) + '\n';
        queue.unshift(marker);
        qBytes += Buffer.byteLength(marker, 'utf8');
      }
      wake();
    } catch {
      // ignore
    }
  });

  async function* iterator() {
    try {
      while (!done) {
        if (queue.length === 0) {
          await new Promise<void>(res => (resolve = res));
          if (done) break;
        }
        while (queue.length > 0) {
          const line = queue.shift()!;
          qBytes -= Buffer.byteLength(line, 'utf8');
          yield line;
        }
      }
    } finally {
      unsub();
      done = true;
    }
  }

  return iterator();
}
