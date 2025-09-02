import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultRunHandle } from '../events/runtime';
import { toISO } from '../events/types';
import { attachRunRecorder, getRecordedRun, setRecorderLimits } from './recorder';

function makeEvent(runId: string, i: number) {
  return { type: 'run/progress', runId, time: toISO(), payload: { message: `message ${i} ` + 'x'.repeat(2000) } } as any;
}

describe('recorder truncation and sanitization', () => {
  beforeEach(() => {
    setRecorderLimits({ maxEvents: 5, maxTotalBytes: 10_000, maxMessageChars: 100, truncateStrategy: 'tail' });
  });

  it('caps message length with markers', () => {
    const h = new DefaultRunHandle('run1');
    const detach = attachRunRecorder(h);
    h.eventBus.emit(makeEvent('run1', 1));
    const rec = getRecordedRun('run1')!;
    const evt = rec.events[0] as any;
    expect(evt.payload.message.length).toBeLessThanOrEqual(120); // includes marker
    expect(evt.payload.message.includes('[TRUNCATED')).toBe(true);
    detach();
  });

  it('drops head events and inserts truncation marker on maxEvents', () => {
    const h = new DefaultRunHandle('run2');
    const detach = attachRunRecorder(h);
    for (let i = 0; i < 10; i++) h.eventBus.emit(makeEvent('run2', i));
    const rec = getRecordedRun('run2')!;
    expect(rec.events.length).toBeLessThanOrEqual(6); // 5 + 1 marker
    // First event should be truncation marker
    expect(rec.events[0].type).toBe('run/truncated');
    const dropped = (rec.events[0] as any).payload.dropped;
    expect(dropped).toBeGreaterThan(0);
    detach();
  });
});
