# Code Standard and Architecture

Purpose
- This document defines how we structure and write code in this repository so contributors can quickly build features with consistent quality.

Architecture at a Glance
- Language/Runtime: TypeScript (ESM). Run with tsx or ts-node ESM.
- Telegram: node-telegram-bot-api (polling mode).
- Backend: Generated OpenAPI client (openapi-typescript-codegen). Configure via src/lib/backendClient.ts.
- Env: Centralized in src/config/env.ts (dotenv). No scattered process.env calls.
- Entry: src/index.ts wires commands, global auth gate, flows, callbacks, and the scheduler.
- Flows: Conversational state machines per-user under src/flows/ using simple in-memory Maps.
- Scheduler: node-cron hourly job that fetches user check-ins and sends messages (TZ from config).
- Sessions: Persisted to .sessions/.sessions.json via src/lib/sessionStore.ts.

Project Structure Rules
- Do not edit generated code under src/generated/backend/; regenerate with npm run generate:backend.
- Do not modify old-system-reference/.
- Update docs/FILE_ORGANISATION.md when adding/moving major directories or entry points.
- Reference this document from README and FILE_ORGANISATION (kept in sync).

TypeScript & Style
- Use Prettier (repo-configured). No semicolons, single quotes, trailing commas, width=100.
- Prefer explicit types for public functions; allow local type inference where clear.
- Naming:
  - camelCase for variables/functions; PascalCase for types/interfaces.
  - UPPER_SNAKE_CASE for constants that represent fixed configuration values.
  - snake_case only when mirroring backend fields (e.g., weight_raw).
- Imports: ESM import/export. Avoid default exports except where the library requires (e.g., TelegramBot default import).
- any usage:
  - Avoid where possible; use narrow types or DTOs.
  - Allowed in thin adapter layers around generated clients or unknown metadata from the backend.
- Errors/Logging:
  - Wrap network/IO in try/catch; log concise diagnostics.
  - Never log secrets, tokens, or access codes.
  - Show user-friendly messages in chat; keep stack/details in server logs only.

Environment Handling
- Load env via src/config/env.ts with dotenv. Required vars must throw on missing.
- Only env.ts reads process.env. Other modules import { config }.
- Respect TZ (config.timezone) for cron scheduling.

Backend Client Usage
- Always call configureBackendClient() early (sets base URL from config).
- Per-user requests must set the bearer via setAccessToken(token) or ensureAccessTokenForUser(userId).
- Never commit tokens to source control or logs.

Telegram Bot Patterns
- Commands: Register via a small registry (src/index.ts) with descriptions; call bot.setMyCommands.
- Auth Gate: On every message, authenticate first (src/lib/auth.ts). Short-circuit if auth handled the message.
- Flows: Maintain lightweight per-user state in memory. Must support /cancel at any time. Remove keyboards when not needed.
- Callback Queries: Namespace callback_data (e.g., goals:...) and always answerCallbackQuery to avoid client spinners.

Scheduler
- Cron: "0 * * * *" (start of every hour), timezone from config.timezone.
- Logic: For each authenticated user, fetch check-ins and send those whose start hour matches the current hour.
- De-duplication: Keep a per-hour in-memory set to prevent double sends.

Persistence & Files
- Session store writes to .sessions/.sessions.json using atomic write (tmp+rename). Treat as private state.
- Do not store PII beyond what is strictly necessary for operation. Do not log session contents.

Testing & Local Dev
- Use npm run format to apply Prettier.
- For scheduler testing, temporarily change the cron expression locally only; do not commit such changes.

PR Expectations
- Keep changes small and focused. Update docs (README and FILE_ORGANISATION) when structure or behavior changes.
- Follow these standards; if an exception is necessary (e.g., around generated types), document with a short comment.
