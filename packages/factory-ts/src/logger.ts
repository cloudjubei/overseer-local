/* Configurable dev logger for factory-ts. Limits noisy console output. */
import type { AgentResponse, ToolCall } from './types.js';

const getIsDev = () => {
  try {
    // @ts-ignore
    const env = typeof process !== 'undefined' ? process.env || {} : ({} as any);
    const nodeEnv = (env.NODE_ENV || '').toLowerCase();
    const flag = String(env.FACTORY_DEBUG || '').toLowerCase();
    return nodeEnv === 'development' || flag === '1' || flag === 'true';
  } catch {
    return false;
  }
};

let IS_DEV = getIsDev();

export function setFactoryDebug(enabled: boolean) {
  IS_DEV = !!enabled;
}

function stamp() {
  try { return new Date().toISOString(); } catch { return ''; }
}

export type LoggerConfig = {
  // Toggle categories for console output
  showThoughts: boolean;
  showToolCalls: boolean;
  showTiming: boolean;
  // How many characters per serialized field
  maxFieldLength: number;
  // Max number of tool calls to log per turn
  maxToolCalls: number;
  // Redact common secret keys in tool args
  redactSecrets: boolean;
};

const DEFAULT_CONFIG: LoggerConfig = {
  showThoughts: true,
  showToolCalls: true,
  showTiming: true,
  maxFieldLength: 400,
  maxToolCalls: 10,
  redactSecrets: true,
};

let CONFIG: LoggerConfig = { ...DEFAULT_CONFIG };

export function setLoggerConfig(cfg: Partial<LoggerConfig>) {
  CONFIG = { ...CONFIG, ...cfg };
}

export function getLoggerConfig(): LoggerConfig {
  return { ...CONFIG };
}

function limit(str: string, n = CONFIG.maxFieldLength) {
  if (typeof str !== 'string') str = String(str ?? '');
  if (n <= 0) return '';
  if (str.length <= n) return str;
  return str.slice(0, Math.max(0, n - 1)) + '…';
}

function redact(obj: any): any {
  if (!CONFIG.redactSecrets) return obj;
  const secretKeys = new Set(['apiKey', 'apikey', 'api_key', 'authorization', 'auth', 'password', 'token', 'access_token', 'refresh_token', 'secret']);
  const walk = (v: any): any => {
    if (v === null || v === undefined) return v;
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      const out: any = Array.isArray(v) ? [] : {};
      for (const [k, val] of Object.entries(v)) {
        if (secretKeys.has(k.toLowerCase())) out[k] = '[REDACTED]';
        else out[k] = walk(val);
      }
      return out;
    }
    return v;
  };
  return walk(obj);
}

function safeStringify(obj: any, maxLen = CONFIG.maxFieldLength): string {
  try {
    const red = redact(obj);
    const s = typeof red === 'string' ? red : JSON.stringify(red);
    return limit(s, maxLen);
  } catch {
    try { return limit(String(obj), maxLen); } catch { return ''; }
  }
}

export const logger = {
  isDev() { return IS_DEV; },
  debug(...args: any[]) {
    if (!IS_DEV) return;
    try { console.debug('[factory-ts]', stamp(), ...args); } catch {}
  },
  info(...args: any[]) {
    if (!IS_DEV) return;
    try { console.info('[factory-ts]', stamp(), ...args); } catch {}
  },
  warn(...args: any[]) {
    try { console.warn('[factory-ts]', stamp(), ...args); } catch {}
  },
  error(...args: any[]) {
    try { console.error('[factory-ts]', stamp(), ...args); } catch {}
  },
};

export function summarizeToolCalls(calls: ToolCall[], maxCalls = CONFIG.maxToolCalls) {
  const arr = Array.isArray(calls) ? calls.slice(0, maxCalls) : [];
  return arr.map((c, i) => {
    const name = c.tool_name || c.tool || c.name || `tool_${i+1}`;
    const args = c.arguments ?? c.parameters ?? {};
    return `${i + 1}. ${name}(${safeStringify(args)})`;
  }).join('\n');
}

export function logLLMStep(data: { turn: number; thoughts?: string; toolCalls?: ToolCall[]; durationMs: number; tag?: string }) {
  if (!IS_DEV) return; // only log in dev/debug builds
  const { turn, thoughts, toolCalls, durationMs, tag } = data;
  const header = tag ? `Turn ${turn} [${tag}]` : `Turn ${turn}`;
  const lines: string[] = [];
  if (CONFIG.showTiming) lines.push(`Time: ${durationMs}ms`);
  if (CONFIG.showThoughts && thoughts) lines.push(`Thoughts: ${limit(thoughts)}`);
  if (CONFIG.showToolCalls && toolCalls && toolCalls.length) {
    lines.push('Tool calls:');
    lines.push(summarizeToolCalls(toolCalls));
  }
  if (lines.length) logger.info(header + '\n' + lines.join('\n'));
}

export default logger;
