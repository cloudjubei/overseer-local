# compass-telegram
The Compass Telegram client code

Notes
- The legacy reference in old-system-reference must not be modified.

Environment Setup
- Copy .env.example to .env and set the required variables:
  - TELEGRAM_BOT_TOKEN
  - BACKEND_SHARED_SECRET
- Optionally set:
  - BACKEND_BASE_URL (defaults to http://localhost:3000)
  - NODE_ENV (defaults to development)
  - TZ (defaults to UTC)
- You can create a .env.local for local overrides (this is ignored by git).

Configuration Loader
- The app uses dotenv to load environment variables.
- Centralized loader is at src/config/env.ts.
- Runtime dependency is already declared in package.json.

Backend API Client Generation
- This project uses openapi-typescript-codegen to generate a TypeScript client from swagger.json.
- Commands:
  - npm install
  - npm run generate:backend
- Output directory: src/generated/backend (do not edit files here manually).
- Configure the client at runtime via src/lib/backendClient.ts, which sets base URL and bearer token:
  - import { configureBackendClient } from './src/lib/backendClient';
  - configureBackendClient({ accessToken: '<JWT>' });

