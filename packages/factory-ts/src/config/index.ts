import path from 'node:path';
import os from 'node:os';
import { setRecorderLimits, TruncationStrategy } from '../errors/redact';

export type ProviderKeys = {
  openai?: { apiKey?: string };
  anthropic?: { apiKey?: string };
  azureOpenAI?: { apiKey?: string; endpoint?: string; deployment?: string };
  openrouter?: { apiKey?: string };
  gemini?: { apiKey?: string };
  github?: { token?: string };
  // Extend with other providers as needed
};

export type PathsConfig = {
  dataDir: string;        // base storage dir (default: <projectRoot>/.thefactory)
  dbPath: string;         // default: <dataDir>/history.sqlite
  artifactsDir: string;   // default: <dataDir>/artifacts
  sandboxesDir: string;   // default: <dataDir>/sandboxes
  logsDir: string;        // default: <dataDir>/logs
  tmpDir: string;         // default: <dataDir>/tmp
};

export type TranscriptLimits = {
  maxEvents: number;         // default 5000
  maxTotalBytes: number;     // default 2_000_000 (~2MB)
  maxMessageChars: number;   // default 8000
  truncationStrategy: TruncationStrategy; // default 'middle'
};

export type DefaultBehaviors = {
  redactSecrets: boolean;    // default true
  transcript: TranscriptLimits;
};

export type FactoryConfig = {
  projectRoot: string;        // defaults to process.cwd()
  paths: PathsConfig;
  provider: ProviderKeys;
  budgetUSD?: number;        // per-run budget default; undefined means unlimited
  defaults: DefaultBehaviors;
};

export type ResolveConfigOptions = {
  projectRoot?: string;
  dataDir?: string;
  dbPath?: string;
  artifactsDir?: string;
  sandboxesDir?: string;
  logsDir?: string;
  tmpDir?: string;
  budgetUSD?: number;
  provider?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    azureOpenAIApiKey?: string;
    azureOpenAIEndpoint?: string;
    azureOpenAIDeployment?: string;
    openrouterApiKey?: string;
    geminiApiKey?: string;
    githubToken?: string;
  };
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>; // explicit env map override
  defaults?: Partial<DefaultBehaviors> & { transcript?: Partial<TranscriptLimits> };
};

// Internal: read env from provided map or process.env
function readEnv(key: string, env?: ResolveConfigOptions['env']): string | undefined {
  const src = env ?? process.env;
  const val = (src as any)?.[key];
  return typeof val === 'string' ? val : undefined;
}

function parseNumberEnv(key: string, env?: ResolveConfigOptions['env']): number | undefined {
  const v = readEnv(key, env);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function boolFromEnv(key: string, env?: ResolveConfigOptions['env']): boolean | undefined {
  const v = readEnv(key, env);
  if (v == null) return undefined;
  const s = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return undefined;
}

function coalesce<T>(...vals: (T | undefined)[]): T | undefined {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

export function resolveConfig(opts: ResolveConfigOptions = {}): FactoryConfig {
  const env = opts.env;

  // projectRoot precedence: opts > FACTORY_PROJECT_ROOT > process.cwd()
  const projectRoot = path.resolve(
    coalesce(opts.projectRoot, readEnv('FACTORY_PROJECT_ROOT', env), process.cwd())!
  );

  // Base data dir precedence: opts.dataDir > FACTORY_DATA_DIR > <projectRoot>/.thefactory > <home>/.thefactory (fallback)
  const defaultProjectData = path.resolve(projectRoot, '.thefactory');
  const homeData = path.resolve(os.homedir?.() ?? projectRoot, '.thefactory');
  const dataDir = path.resolve(
    coalesce(opts.dataDir, readEnv('FACTORY_DATA_DIR', env), defaultProjectData, homeData)!
  );

  // Individual paths
  const dbPath = path.resolve(
    coalesce(
      opts.dbPath,
      readEnv('FACTORY_DB_PATH', env),
      path.join(dataDir, 'history.sqlite')
    )!
  );

  const artifactsDir = path.resolve(
    coalesce(opts.artifactsDir, readEnv('FACTORY_ARTIFACTS_DIR', env), path.join(dataDir, 'artifacts'))!
  );
  const sandboxesDir = path.resolve(
    coalesce(opts.sandboxesDir, readEnv('FACTORY_SANDBOX_DIR', env), path.join(dataDir, 'sandboxes'))!
  );
  const logsDir = path.resolve(
    coalesce(opts.logsDir, readEnv('FACTORY_LOGS_DIR', env), path.join(dataDir, 'logs'))!
  );
  const tmpDir = path.resolve(
    coalesce(opts.tmpDir, readEnv('FACTORY_TMP_DIR', env), path.join(dataDir, 'tmp'))!
  );

  // Budget precedence: opts > FACTORY_BUDGET_USD > undefined
  const budgetUSD = coalesce(opts.budgetUSD, parseNumberEnv('FACTORY_BUDGET_USD', env));

  // Providers precedence: opts.provider > env > undefined
  const provider: ProviderKeys = {
    openai: { apiKey: coalesce(opts.provider?.openaiApiKey, readEnv('OPENAI_API_KEY', env)) },
    anthropic: { apiKey: coalesce(opts.provider?.anthropicApiKey, readEnv('ANTHROPIC_API_KEY', env)) },
    azureOpenAI: {
      apiKey: coalesce(opts.provider?.azureOpenAIApiKey, readEnv('AZURE_OPENAI_KEY', env), readEnv('AZURE_OPENAI_API_KEY', env)),
      endpoint: coalesce(opts.provider?.azureOpenAIEndpoint, readEnv('AZURE_OPENAI_ENDPOINT', env)),
      deployment: coalesce(opts.provider?.azureOpenAIDeployment, readEnv('AZURE_OPENAI_DEPLOYMENT', env)),
    },
    openrouter: { apiKey: coalesce(opts.provider?.openrouterApiKey, readEnv('OPENROUTER_API_KEY', env)) },
    gemini: { apiKey: coalesce(opts.provider?.geminiApiKey, readEnv('GEMINI_API_KEY', env), readEnv('GOOGLE_API_KEY', env)) },
    github: { token: coalesce(opts.provider?.githubToken, readEnv('GITHUB_TOKEN', env)) },
  };

  // Defaults: redact + transcript caps
  const redactSecrets = coalesce(opts.defaults?.redactSecrets, boolFromEnv('FACTORY_REDACT_SECRETS', env));
  const transcript: TranscriptLimits = {
    maxEvents: coalesce(opts.defaults?.transcript?.maxEvents, parseNumberEnv('FACTORY_TRANSCRIPT_MAX_EVENTS', env), 5000)!,
    maxTotalBytes: coalesce(opts.defaults?.transcript?.maxTotalBytes, parseNumberEnv('FACTORY_TRANSCRIPT_MAX_BYTES', env), 2_000_000)!,
    maxMessageChars: coalesce(opts.defaults?.transcript?.maxMessageChars, parseNumberEnv('FACTORY_TRANSCRIPT_MAX_MESSAGE_CHARS', env), 8000)!,
    truncationStrategy: coalesce(
      opts.defaults?.transcript?.truncationStrategy,
      (readEnv('FACTORY_TRANSCRIPT_TRUNCATION_STRATEGY', env) as TruncationStrategy | undefined),
      'middle'
    )!,
  };

  const defaults: DefaultBehaviors = {
    redactSecrets: redactSecrets ?? true,
    transcript,
  };

  return {
    projectRoot,
    paths: { dataDir, dbPath, artifactsDir, sandboxesDir, logsDir, tmpDir },
    provider,
    budgetUSD,
    defaults,
  };
}

let GLOBAL_CONFIG: FactoryConfig | undefined;

export function setConfig(configOrOpts: FactoryConfig | ResolveConfigOptions): FactoryConfig {
  GLOBAL_CONFIG = isFactoryConfig(configOrOpts) ? configOrOpts : resolveConfig(configOrOpts);
  return GLOBAL_CONFIG;
}

export function getConfig(): FactoryConfig {
  if (!GLOBAL_CONFIG) GLOBAL_CONFIG = resolveConfig();
  return GLOBAL_CONFIG;
}

function isFactoryConfig(v: any): v is FactoryConfig {
  return v && typeof v === 'object' && v.paths && typeof v.paths.dbPath === 'string';
}

// Apply runtime-affecting config (e.g., transcript limits -> recorder)
export function applyRuntimeConfig(cfg?: FactoryConfig): void {
  const c = cfg ?? getConfig();
  const t = c.defaults.transcript;
  setRecorderLimits({
    maxEvents: t.maxEvents,
    maxTotalBytes: t.maxTotalBytes,
    maxMessageChars: t.maxMessageChars,
    truncateStrategy: t.truncationStrategy,
  });
}

// Utility that returns a snapshot suitable for logging/diagnostics with secrets elided
export function summarizeConfig(cfg?: FactoryConfig): Record<string, unknown> {
  const c = cfg ?? getConfig();
  return {
    projectRoot: c.projectRoot,
    paths: c.paths,
    provider: {
      openai: { apiKey: mask(c.provider.openai?.apiKey) },
      anthropic: { apiKey: mask(c.provider.anthropic?.apiKey) },
      azureOpenAI: {
        apiKey: mask(c.provider.azureOpenAI?.apiKey),
        endpoint: c.provider.azureOpenAI?.endpoint,
        deployment: c.provider.azureOpenAI?.deployment,
      },
      openrouter: { apiKey: mask(c.provider.openrouter?.apiKey) },
      gemini: { apiKey: mask(c.provider.gemini?.apiKey) },
      github: { token: mask(c.provider.github?.token) },
    },
    budgetUSD: c.budgetUSD,
    defaults: c.defaults,
  };
}

function mask(v?: string): string | undefined {
  if (!v) return v;
  if (v.length <= 8) return '***';
  return v.slice(0, 4) + '***' + v.slice(-2);
}
