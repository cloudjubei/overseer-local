Project File Organisation

Overview
- This repository contains a new TypeScript-based Telegram bot implementation alongside a read-only legacy reference under old-system-reference.
- Environment configuration is centralized and loaded via dotenv.

Key Directories and Files
- src/
  - index.ts: Application entry point. Loads environment, starts the Telegram bot (node-telegram-bot-api), and wires a minimal, extensible command handler with a /start command and global authentication gate. Also registers /profile and /cancel commands, and routes messages into conversation flows. Handles inline callback queries (goal suggestions selection, etc.). Initializes the scheduler for periodic check-ins and shuts it down gracefully on process exit.
  - config/
    - env.ts: Centralized environment loader using dotenv. Validates required variables and exposes a typed config.
  - generated/
    - backend/: Code generated from swagger.json using openapi-typescript-codegen (DO NOT EDIT MANUALLY). Regenerate with npm run generate:backend.
  - lib/
    - backendClient.ts: Helper to configure the generated client's OpenAPI base URL and bearer token at runtime.
    - sessionStore.ts: Simple file-based session store that persists Telegram user sessions under .sessions/sessions.json. Exposes getAllUserIds() to iterate all known users.
    - auth.ts: Authentication flow utilities. Prompts unauthenticated users for an access code, logs in via backend (AuthController_loginTelegram), and stores session tokens. Exposes helpers to configure the client per-callback/message.
    - scheduler.ts: Cron-based scheduler that runs every hour at the beginning of the hour (e.g., 09:00, 10:00). Currently the core job logic is a placeholder (no-op) in preparation for the check-in functionality that will query the backend and send messages when appropriate.
  - flows/
    - profile.ts: Conversation flow for updating the user profile. Guides user through DOB, gender, weight, height; then calls ProfilesService (PATCH /profiles/me, fallback POST if needed).
    - newGoal.ts: Conversation flow for creating a new goal from free text. Collects initial text, calls GoalsService (POST /goals/ai/suggestions) and displays AI suggestions via inline keyboard. Allows the user to pick a suggestion to create the goal immediately (POST /goals) or refine the message for another suggestion round. Supports cancel at any time.
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
  - TZ: Timezone for scheduled jobs (default: UTC). The scheduler in src/lib/scheduler.ts uses this value for cron jobs.

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
- Run the bot entry (example via ts-node/loader or compiled JS). The entry sets up polling and handles /start.

Authentication Flow (Implemented)
- On any user message, the bot checks authentication state using src/lib/auth.ts.
- If unauthenticated, the bot prompts for an access code and expects a plain-text reply.
- The bot sends { externalId: <Telegram user id>, accessCode, secret: BACKEND_SHARED_SECRET } to /auth/login/telegram via the generated AuthService.
- On success, accessToken and related tokens are persisted via src/lib/sessionStore.ts, avoiding future prompts.
- Users can /logout to clear the stored session.

Scheduler (Hourly Placeholder)
- A scheduler runs at the start of every hour (cron: "0 * * * *") respecting the TZ environment variable (default: UTC).
- The scheduled task is currently a no-op placeholder. Future implementation will query the backend for user check-ins and send messages when appropriate.

Profile Update Flow (Implemented)
- Command: /profile starts a guided flow asking for DOB (YYYY-MM-DD), gender (buttons + free text), weight (free text), and height (free text). Users can type 'skip' to leave any field unchanged and /cancel to abort.
- After collecting answers, the bot sends the data to the backend using the generated ProfilesService. It first attempts PATCH /profiles/me; if the profile does not exist (404), it falls back to POST /profiles/me to create it.
- Free-text for weight and height is passed as weight_raw and height_raw for backend normalization.

New Goal Flow (Implemented)
- Command: /newgoal starts a flow that asks the user to describe their goal in free text.
- The bot sends this text to POST /goals/ai/suggestions and receives AI-generated suggestions.
- Suggestions are displayed using an inline keyboard. The user can:
  - Tap a suggestion to immediately create it via POST /goals.
  - Tap "Refine message" to send a new/edited description and request suggestions again.
  - Tap "Cancel" to abort.

Notes
- Do not modify files under old-system-reference/.
- Do not manually edit generated files under src/generated/backend/.
