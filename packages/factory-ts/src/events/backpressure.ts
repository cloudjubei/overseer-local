import type { RunEvent, RunEventListener } from './types';

// A minimal fixed-size ring buffer for events, useful to mitigate slow consumers.
export class EventRingBuffer {
  private buf: RunEvent[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number = 1000) {
    this.buf = new Array(capacity);
  }

  push(e: RunEvent) {
    this.buf[this.head] = e;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  // Returns events in chronological order
  snapshot(): RunEvent[] {
    const out: RunEvent[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.capacity) % this.capacity;
      const v = this.buf[idx];
      if (v) out.push(v);
    }
    return out;
  }
}

export function withReplay(buffer: EventRingBuffer, listener: RunEventListener): RunEventListener {
  // Provide historical snapshot first, then real-time events
  const history = buffer.snapshot();
  for (const e of history) listener(e);
  return listener;
}
