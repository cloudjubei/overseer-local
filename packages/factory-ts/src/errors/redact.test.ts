import { describe, it, expect, beforeEach } from 'vitest';
import { configureRedaction, getRedactionConfig, redactObject, redactString, truncateString } from './redact';

describe('redaction utilities', () => {
  beforeEach(() => {
    configureRedaction(); // reset to defaults
  });

  it('redacts common API keys and tokens in strings', () => {
    const input = 'Use sk-ABCDEF1234567890ABCDE and Authorization: Bearer foo.bar.baz and OPENAI_API_KEY=xyz';
    const out = redactString(input);
    expect(out).not.toContain('sk-ABCDEF');
    expect(out).toContain('sk-***REDACTED***');
    expect(out).toContain('Authorization: Bearer ***REDACTED***');
    expect(out).toContain('OPENAI_API_KEY=***REDACTED***');
  });

  it('supports extra patterns via configureRedaction', () => {
    configureRedaction({ extraPatterns: [{ pattern: /supersecret/gi, replacement: '***REDACTED***' }] });
    const out = redactString('this contains supersecret value');
    expect(out).toBe('this contains ***REDACTED*** value');
  });

  it('redacts sensitive object keys recursively', () => {
    const obj = { apiKey: 'abcd', nested: { password: 'pw', deep: { token: 'tok' } }, keep: 'value' };
    const red = redactObject(obj);
    expect(red.apiKey).toBe('***REDACTED***');
    expect(red.nested.password).toBe('***REDACTED***');
    expect(red.nested.deep.token).toBe('***REDACTED***');
    expect(red.keep).toBe('value');
  });

  it('truncateString applies markers and strategies', () => {
    const s = 'abcdefghijklmnopqrstuvwxyz';
    const t1 = truncateString(s, 10, 'head');
    expect(t1.truncated).toBe(true);
    expect(t1.text.endsWith('jklmnopqrstuvwxyz')).toBe(true);
    expect(t1.text.includes('[TRUNCATED')).toBe(true);

    const t2 = truncateString(s, 10, 'tail');
    expect(t2.text.startsWith('abcdefghij')).toBe(true);
    expect(t2.text.includes('[TRUNCATED')).toBe(true);

    const t3 = truncateString(s, 10, 'middle');
    expect(t3.text.startsWith('abc')).toBe(true);
    expect(t3.text.includes('[TRUNCATED')).toBe(true);
    expect(t3.text.endsWith('xyz')).toBe(true);
  });
});
