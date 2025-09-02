import { EventBus, RunEvent, RunEventListener, RunHandle, RunId, toISO } from './types';

export class SimpleEventBus implements EventBus {
  private listeners = new Set<RunEventListener>();

  emit(event: RunEvent): void {
    for (const l of Array.from(this.listeners)) {
      try {
        l(event);
      } catch (_) {
        // swallow listener errors to keep bus resilient
      }
    }
  }

  on(listener: RunEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export class DefaultRunHandle implements RunHandle {
  public id: RunId;
  private bus: EventBus;
  private cancelled = false;
  private abortController: AbortController;

  constructor(id: RunId, bus?: EventBus, abortController?: AbortController) {
    this.id = id;
    this.bus = bus ?? new SimpleEventBus();
    this.abortController = abortController ?? new AbortController();
  }

  onEvent(listener: RunEventListener): () => void {
    return this.bus.on(listener);
  }

  cancel(reason?: string): void {
    if (this.cancelled) return;
    this.cancelled = true;
    this.abortController.abort(reason ? new Error(reason) : undefined);
    this.bus.emit({ type: 'run/cancelled', runId: this.id, time: toISO(), payload: { reason } });
  }

  isCancelled(): boolean {
    return this.cancelled || this.abortController.signal.aborted;
  }

  get signal(): AbortSignal {
    return this.abortController.signal;
  }

  get eventBus(): EventBus {
    return this.bus;
  }
}

export function makeRunId(prefix = 'run'): RunId {
  // Simple unique ID generator suitable for local runs.
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}
