# Configuration: paths, providers, budgets, and defaults

This document describes how Factory TS resolves configuration for storage paths, database file, provider API keys, budgets, and default behaviors. All core services should consume configuration via the config module for consistency.

Module entry: packages/factory-ts/src/config
- resolveConfig(options?): Returns a complete FactoryConfig by merging explicit options, environment variables, and sensible defaults.
- getConfig(): Returns a cached, process-wide configuration (lazy-resolved).
- setConfig(configOrOptions): Set the global configuration (or resolve from options) to be used by consumers.
- applyRuntimeConfig(cfg?): Applies runtime-affecting settings (e.g., transcript caps) to the recorder.
- summarizeConfig(cfg?): Returns a diagnostic snapshot with secrets masked.

Precedence rules (highest to lowest):
1) Explicit function options (resolveConfig/setConfig overrides)
2) Environment variables provided in options.env (if any)
3) Process environment variables (process.env)
4) Built-in defaults

Paths and defaults:
- projectRoot: defaults to process.cwd(); override via options.projectRoot or FACTORY_PROJECT_ROOT.
- dataDir: base directory for storage. Defaults to <projectRoot>/.thefactory; override via options.dataDir or FACTORY_DATA_DIR.
- dbPath: defaults to <dataDir>/history.sqlite; override via options.dbPath or FACTORY_DB_PATH.
- artifactsDir: defaults to <dataDir>/artifacts; override via options.artifactsDir or FACTORY_ARTIFACTS_DIR.
- sandboxesDir: defaults to <dataDir>/sandboxes; override via options.sandboxesDir or FACTORY_SANDBOX_DIR.
- logsDir: defaults to <dataDir>/logs; override via options.logsDir or FACTORY_LOGS_DIR.
- tmpDir: defaults to <dataDir>/tmp; override via options.tmpDir or FACTORY_TMP_DIR.

Budget:
- budgetUSD (per-run default): options.budgetUSD > FACTORY_BUDGET_USD > undefined (no limit). Individual runs can still override.

Provider keys:
- openai.apiKey: OPENAI_API_KEY or options.provider.openaiApiKey
- anthropic.apiKey: ANTHROPIC_API_KEY or options.provider.anthropicApiKey
- azureOpenAI: AZURE_OPENAI_KEY (or AZURE_OPENAI_API_KEY), AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT or corresponding option fields
- openrouter.apiKey: OPENROUTER_API_KEY or options.provider.openrouterApiKey
- gemini.apiKey: GEMINI_API_KEY (or GOOGLE_API_KEY) or options.provider.geminiApiKey
- github.token: GITHUB_TOKEN or options.provider.githubToken

Default behaviors:
- redactSecrets: default true; override via options.defaults.redactSecrets or FACTORY_REDACT_SECRETS.
- transcript caps used by the run recorder (to bound memory and archive size):
  - FACTORY_TRANSCRIPT_MAX_EVENTS (default 5000)
  - FACTORY_TRANSCRIPT_MAX_BYTES (default 2_000_000)
  - FACTORY_TRANSCRIPT_MAX_MESSAGE_CHARS (default 8000)
  - FACTORY_TRANSCRIPT_TRUNCATION_STRATEGY ('head' | 'middle' | 'tail'; default 'middle')

Applying runtime defaults:
- Call applyRuntimeConfig() once during process initialization to push transcript caps into the recorder limits.

Usage examples:

```ts
import { resolveConfig, applyRuntimeConfig } from 'factory-ts';

// Resolve with overrides and custom env map (for tests)
const cfg = resolveConfig({
  projectRoot: '/path/to/project',
  budgetUSD: 10,
  provider: { openaiApiKey: process.env.OPENAI_API_KEY },
  env: { FACTORY_DATA_DIR: '/tmp/thefactory' },
});
applyRuntimeConfig(cfg);

// Later in services
import { getConfig } from 'factory-ts';
const { paths, provider, budgetUSD } = getConfig();
```

Notes:
- Do not read provider keys or storage paths directly from process.env in services; always use the config module.
- Overseer can pass its own resolved app config/environment to resolveConfig so both processes agree on paths and budgets.
