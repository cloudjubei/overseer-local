/*
 * Electron Overseer integration shim (adapter only)
 * - Exposes IPC-serializable event payloads
 * - Utilities to consume RunHandle as JSONL stream, EventSource-like, or Observable
 * - No direct Electron IPC imports in this file — caller wires to ipcMain/ipcRenderer
 */

import { RunEvent, RunHandle, RunId, RunEventListener } from '../events/types';

// Safe serializer: ensure plain JSON without functions/BigInt/etc.
export function serializeEvent(e: RunEvent): any {
  // Payloads are already primitives or plain objects by convention.
  // Shallow clone ensures no prototype leakage.
  return JSON.parse(JSON.stringify(e));
}

export function encodeJSONL(e: RunEvent): string {
  return JSON.stringify(serializeEvent(e)) + '\n';
}

export function streamJSONL(handle: RunHandle): AsyncIterable<string> {
  // Creates an async iterable of JSONL encoded events. Useful for piping to processes.
  const queue: string[] = [];
  const waiters: ((value: IteratorResult<string>) => void)[] = [];
  let done = false;

  const unsubscribe = handle.onEvent((evt) => {
    queue.push(encodeJSONL(evt));
    const waiter = waiters.shift();
    if (waiter) waiter({ value: queue.shift()!, done: false });
  });

  const iterator: AsyncIterator<string> = {
    next: () => {
      if (queue.length) return Promise.resolve({ value: queue.shift()!, done: false });
      if (done) return Promise.resolve({ value: undefined as any, done: true });
      return new Promise((resolve) => waiters.push(resolve));
    },
    return: () => {
      done = true;
      unsubscribe();
      // flush waiters
      while (waiters.length) waiters.shift()!({ value: undefined as any, done: true });
      return Promise.resolve({ value: undefined as any, done: true });
    },
  };

  return {
    [Symbol.asyncIterator]() {
      return iterator;
    },
  };
}

// EventSource-like shim for React/Electron that uses addEventListener/removeEventListener
export type EventSourceLike = {
  addEventListener: (type: RunEvent['type'] | '*', listener: (e: RunEvent) => void) => void;
  removeEventListener: (type: RunEvent['type'] | '*', listener: (e: RunEvent) => void) => void;
  close: () => void;
  runId: RunId;
};

export function toEventSourceLike(handle: RunHandle): EventSourceLike {
  const all = new Set<(e: RunEvent) => void>();
  const byType = new Map<RunEvent['type'], Set<(e: RunEvent) => void>>();

  const off = handle.onEvent((e) => {
    for (const fn of all) fn(e);
    const typed = byType.get(e.type);
    if (typed) for (const fn of typed) fn(e);
  });

  return {
    runId: handle.id,
    addEventListener: (type, listener) => {
      if (type === '*') {
        all.add(listener);
      } else {
        if (!byType.has(type)) byType.set(type, new Set());
        byType.get(type)!.add(listener);
      }
    },
    removeEventListener: (type, listener) => {
      if (type === '*') {
        all.delete(listener);
      } else {
        const set = byType.get(type);
        if (set) set.delete(listener);
      }
    },
    close: () => {
      off();
      all.clear();
      byType.clear();
    },
  };
}

// Minimal Observable type (no external deps) with teardown
export type Observable<T> = {
  subscribe: (observer: { next: (v: T) => void; complete?: () => void }) => { unsubscribe: () => void };
};

export function toObservable(handle: RunHandle): Observable<RunEvent> {
  return {
    subscribe: (observer) => {
      const un = handle.onEvent((e) => observer.next(e));
      return { unsubscribe: () => un() };
    },
  };
}

// Helper to mirror events over an arbitrary send(channel, payload) interface.
// Useful for wiring to Electron ipcMain/ipcRenderer without importing electron here.
export type Sender = (channel: string, payload: any) => void;

export function bridgeToSender(handle: RunHandle, channel: string, send: Sender): () => void {
  const listener: RunEventListener = (evt) => send(channel, serializeEvent(evt));
  return handle.onEvent(listener);
}

// Allow combining multiple RunHandles into one observable stream (e.g., multi-agent runs)
export function mergeHandles(handles: RunHandle[]): Observable<RunEvent> {
  return {
    subscribe: (observer) => {
      const unsubs = handles.map((h) => h.onEvent((e) => observer.next(e)));
      return { unsubscribe: () => unsubs.forEach((u) => u()) };
    },
  };
}
