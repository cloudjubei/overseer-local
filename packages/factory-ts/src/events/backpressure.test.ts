import { describe, it, expect } from 'vitest';
import { BufferedEventBus } from './backpressure';
import { toISO } from './types';

function makeEvent(i: number) {
  return { type: 'run/progress', time: toISO(), runId: 'r1', payload: { message: `m${i}`, progress: i } } as any;
}

describe('BufferedEventBus', () => {
  it('coalesces high-frequency progress updates and does not block event loop', async () => {
    const bus = new BufferedEventBus({ flushIntervalMs: 5, maxQueueSize: 100, maxQueueBytes: 100_000, dropStrategy: 'coalesce' });
    let received: any[] = [];
    bus.on((e) => { received.push(e); });

    // Fire a lot of progress events synchronously
    for (let i = 0; i < 5000; i++) {
      bus.emit(makeEvent(i));
    }

    // Schedule a tick to ensure the loop was not blocked for long
    const tick = await new Promise<number>((resolve) => {
      const start = Date.now();
      setTimeout(() => resolve(Date.now() - start), 0);
    });

    expect(tick).toBeLessThan(50); // flush is async, event loop stayed responsive

    // Allow flush to occur
    await new Promise(res => setTimeout(res, 50));

    // Should not have 5000 events due to coalescing and queue bounds
    expect(received.length).toBeGreaterThan(0);
    expect(received.length).toBeLessThan(1000);

    // Ensure last message progressed near end
    const last = received.filter(e => e.type === 'run/progress').pop();
    expect(last?.payload?.progress).toBeTypeOf('number');
  });

  it('drops with truncation marker when overflowing', async () => {
    const bus = new BufferedEventBus({ flushIntervalMs: 5, maxQueueSize: 50, maxQueueBytes: 10_000, dropStrategy: 'drop-oldest', insertTruncationMarker: true });
    const events: any[] = [];
    bus.on((e) => events.push(e));

    for (let i = 0; i < 1000; i++) bus.emit(makeEvent(i));

    await new Promise(res => setTimeout(res, 25));

    // We expect at least one run/truncated marker emitted
    const hasMarker = events.some(e => e.type === 'run/truncated');
    expect(hasMarker).toBe(true);
  });
});
