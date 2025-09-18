Project File Organisation

Overview
- This repository contains a new TypeScript-based Telegram bot implementation alongside a read-only legacy reference under old-system-reference.
- Environment configuration is centralized and loaded via dotenv.

Key Directories and Files
- src/
  - config/
    - env.ts: Centralized environment loader using dotenv. Validates required variables and exposes a typed config.
  - generated/
    - backend/: Code generated from swagger.json using openapi-typescript-codegen (DO NOT EDIT MANUALLY). Regenerate with npm run generate:backend.
  - lib/
    - backendClient.ts: Helper to configure the generated client's OpenAPI base URL and bearer token at runtime.
- docs/
  - FILE_ORGANISATION.md: This document. Update when major structural changes occur.
- mock-interface.tsx, mock-interface.css: UI mock and styles for reference in designing user flows.
- swagger.json: OpenAPI spec used to generate backend client code (do not modify here; used by generator).
- old-system-reference/: Legacy system reference (DO NOT MODIFY).

Environment Handling
- Uses dotenv to load variables from .env and optional overrides from .env.local.
- Required variables:
  - TELEGRAM_BOT_TOKEN: Telegram bot token from BotFather.
  - BACKEND_SHARED_SECRET: Shared secret to authenticate with backend.
- Optional variables:
  - BACKEND_BASE_URL: Base URL of backend API (default: http://localhost:3000).
  - NODE_ENV: Node environment (default: development).
  - TZ: Timezone for scheduled jobs (default: UTC).

Setup Steps
1) Copy .env.example to .env and fill in the required values.
2) Optionally create a .env.local for machine-specific overrides (git-ignored).
3) Install dependencies in the project:
   - npm install
4) Generate the backend API client (whenever swagger.json changes):
   - npm run generate:backend

Usage
- Import configuration from src/config/env.ts:
  - import { config } from '../config/env';
  - const token = config.telegramBotToken;
- Configure the generated backend client before using any services:
  - import { configureBackendClient } from '../lib/backendClient';
  - configureBackendClient({ accessToken: 'JWT_ACCESS_TOKEN' });
  - Then call generated services, e.g.:
    - import { GoalsService } from '../generated/backend';
    - await GoalsService.GoalsController_list({ limit: 10 });

Notes
- Do not modify files under old-system-reference/.
- Do not manually edit generated files under src/generated/backend/.
