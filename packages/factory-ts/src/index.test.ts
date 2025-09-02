import { describe, it, expect } from 'vitest';
import { createFactory, OverseerFactory } from './index';

describe('@overseer/factory', () => {
  it('creates factory and greets', () => {
    const f = createFactory({ version: '0.0.0' });
    expect(f.hello('tester')).toContain('tester');
    expect(f).toBeInstanceOf(OverseerFactory);
  });
});
