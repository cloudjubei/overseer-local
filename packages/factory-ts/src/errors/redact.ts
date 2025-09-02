export type RedactionPattern = { pattern: RegExp; replacement: string };

export type RedactionConfig = {
  patterns: RedactionPattern[];
  objectKeys: string[]; // keys to mask in objects
};

const DEFAULT_PATTERNS: RedactionPattern[] = [
  // OpenAI-like keys
  { pattern: /sk-[A-Za-z0-9]{20,}/g, replacement: 'sk-***REDACTED***' },
  // API key query params
  { pattern: /(?:(?:api[-_]?key|access[_-]?token|token|auth)\s*[=:]\s*)([A-Za-z0-9-_]{10,})/gi, replacement: '$1***REDACTED***' },
  // Authorization: Bearer <token>
  { pattern: /(Authorization:\s*Bearer\s+)[A-Za-z0-9-_\.]+/gi, replacement: '$1***REDACTED***' },
  // Common env vars
  { pattern: /(OPENAI_API_KEY|ANTHROPIC_API_KEY|AZURE_OPENAI_KEY|GITHUB_TOKEN|NPM_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID)=[^\s]+/g, replacement: '$1=***REDACTED***' },
  // Generic long hex secrets
  { pattern: /\b[0-9a-fA-F]{32,}\b/g, replacement: '***REDACTED***' },
  // URLs with creds https://user:pass@host
  { pattern: /(https?:\/\/)([^:\/@\s]+):([^@\s]+)@/g, replacement: '$1$2:***REDACTED***@' },
];

const DEFAULT_OBJECT_KEYS = ['apiKey', 'password', 'token', 'authorization', 'auth', 'secret', 'clientSecret', 'privateKey'];

let GLOBAL_REDACTION: RedactionConfig = {
  patterns: [...DEFAULT_PATTERNS],
  objectKeys: [...DEFAULT_OBJECT_KEYS],
};

export function configureRedaction(opts: { extraPatterns?: RedactionPattern[]; overridePatterns?: RedactionPattern[]; objectKeys?: string[] } = {}): void {
  if (opts.overridePatterns) {
    GLOBAL_REDACTION.patterns = [...opts.overridePatterns];
  } else if (opts.extraPatterns?.length) {
    GLOBAL_REDACTION.patterns = [...DEFAULT_PATTERNS, ...opts.extraPatterns];
  } else {
    GLOBAL_REDACTION.patterns = [...DEFAULT_PATTERNS];
  }
  if (opts.objectKeys) GLOBAL_REDACTION.objectKeys = [...opts.objectKeys];
}

export function getRedactionConfig(): RedactionConfig {
  return { patterns: [...GLOBAL_REDACTION.patterns], objectKeys: [...GLOBAL_REDACTION.objectKeys] };
}

export function redactString(input: string, extra?: Array<[RegExp, string]>): string {
  const extraPatterns: RedactionPattern[] = (extra ?? []).map(([pattern, replacement]) => ({ pattern, replacement }));
  const patterns = [...GLOBAL_REDACTION.patterns, ...extraPatterns];
  let out = input;
  for (const { pattern, replacement } of patterns) out = out.replace(pattern, replacement);
  return out;
}

export function redactObject<T extends Record<string, any>>(obj: T, keys?: string[]): T {
  const keySet = new Set((keys && keys.length ? keys : GLOBAL_REDACTION.objectKeys).map((k) => k.toLowerCase()))
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...obj };
  for (const k of Object.keys(clone)) {
    const v = clone[k];
    if (keySet.has(k.toLowerCase())) {
      clone[k] = '***REDACTED***';
    } else if (v && typeof v === 'object') {
      clone[k] = redactObject(v, Array.from(keySet));
    } else if (typeof v === 'string') {
      clone[k] = redactString(v);
    }
  }
  return clone as T;
}

export function safeErrorPayload(err: unknown): { name: string; code?: string; message: string; stack?: string } {
  const name = (err as any)?.name ?? 'Error';
  const message = typeof (err as any)?.message === 'string' ? redactString((err as any).message) : 'Error';
  const code = (err as any)?.code;
  const stack = typeof (err as any)?.stack === 'string' ? redactString((err as any).stack) : undefined;
  return { name, code, message, stack };
}

export type TruncationStrategy = 'head' | 'middle' | 'tail';

export function truncateString(input: string, maxChars: number, strategy: TruncationStrategy = 'middle'): { text: string; truncated: boolean; dropped: number } {
  if (maxChars <= 0) return { text: '', truncated: input.length > 0, dropped: input.length };
  if (input.length <= maxChars) return { text: input, truncated: false, dropped: 0 };
  const dropped = input.length - maxChars;
  const marker = ` … [TRUNCATED ${dropped} chars] `;
  if (strategy === 'head') {
    const slice = input.slice(input.length - maxChars);
    return { text: marker + slice, truncated: true, dropped };
  }
  if (strategy === 'tail') {
    const slice = input.slice(0, maxChars);
    return { text: slice + marker, truncated: true, dropped };
  }
  // middle
  const half = Math.max(0, Math.floor((maxChars - marker.length) / 2));
  const left = input.slice(0, half);
  const right = input.slice(input.length - half);
  const remain = maxChars - (left.length + right.length);
  const left2 = remain > 0 ? input.slice(0, half + Math.floor(remain / 2)) : left;
  const right2 = remain > 0 ? input.slice(input.length - (half + Math.ceil(remain / 2))) : right;
  return { text: left2 + marker + right2, truncated: true, dropped };
}

// Convenience: deep-redact any value (string or object)
export function deepRedact<T>(obj: T): T {
  try {
    if (obj && typeof obj === 'object') return redactObject(obj as any) as any as T;
    if (typeof obj === 'string') return redactString(obj) as any as T;
    return obj;
  } catch {
    return obj as T;
  }
}
