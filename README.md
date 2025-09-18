# Compass Telegram Bot

A TypeScript-based Telegram bot for Compass that relies on a generated backend client from swagger.json and the node-telegram-bot-api library. It authenticates users using a shared secret and a per-user access code validated by the backend.

Important
- Do not modify files under old-system-reference/.
- Do not manually edit generated files under src/generated/backend/.

Contents
- Overview
- Prerequisites
- Local Setup and Run
- Backend Client Generation
- Environment Variables
- Using the Bot (commands and flows)
- Testing Locally (including scheduler)
- Deploying on AWS EC2 (PM2 recommended)
- Testing the UI (Telegram flows and mock interface)

Overview
- Tech:
  - TypeScript + ESM
  - node-telegram-bot-api for Telegram
  - openapi-typescript-codegen for backend client (axios)
  - dotenv for env management
  - node-cron for scheduled messages
- Core flows:
  - Authentication via shared secret + user access code
  - Profile update (/profile)
  - Goal creation with AI suggestions (/newgoal)
  - List micro and macro goals (/microgoals, /macrogoals)
  - Daily placeholder check-ins ("hello") at 09:00 and 19:00 in TZ

Prerequisites
- Node.js 18+ (LTS recommended) and npm 9+
- A Telegram bot token from @BotFather
- A backend URL and a shared secret provided by your backend team
- An access code generation/management process on the backend side

Local Setup and Run
1) Clone and configure environment
- git clone <repo-url>
- cd compass-telegram
- cp .env.example .env and fill in the values (see Environment Variables below)

2) Install dependencies
- npm install

3) Generate the backend client (from swagger.json)
- npm run generate:backend
Note: Re-run this whenever swagger.json changes.

4) Run the bot
Option A: Using tsx (recommended for ESM + TS)
- Run: npx tsx src/index.ts

Option B: Using ts-node
- Run: npx ts-node --esm src/index.ts

You should see a log similar to:
- Compass Telegram Bot started. Environment: development. Timezone: UTC
- Scheduler initialized. Daily check-ins at 09:00 and 19:00 (UTC).

5) Talk to your bot in Telegram
- Open your bot chat using the handle created with @BotFather
- Send /start and follow prompts

Backend Client Generation
- Script: npm run generate:backend
- Output: src/generated/backend
- Generator: openapi-typescript-codegen (axios client, useOptions)
- Do not modify generated files manually.

Environment Variables
Required
- TELEGRAM_BOT_TOKEN: Your bot token from @BotFather
- BACKEND_SHARED_SECRET: Shared secret the bot sends to backend during login

Optional
- BACKEND_BASE_URL: Backend API base URL (default http://localhost:3000)
- NODE_ENV: development | test | production (default development)
- TZ: Timezone for scheduled jobs (default UTC). Example: Europe/London

Using the Bot (commands and flows)
Authentication
- The first message triggers an auth check.
- The bot asks for your access code. It then calls the backend with:
  { externalId: <telegram user id>, accessCode, secret: BACKEND_SHARED_SECRET }
- On success, a session with tokens is persisted in .factory/sessions.json for reuse.
- /logout clears the stored session.

Available commands
- /start: Welcome + basic instructions
- /profile: Guided flow to update profile (DOB YYYY-MM-DD, gender, weight free text, height free text). Reply with skip to leave any field unchanged. /cancel to abort.
- /newgoal: Describe your goal in free text. The bot calls the backend for AI suggestions and shows them as inline buttons. You can pick one to create immediately, refine your message, or cancel.
- /microgoals: Lists current micro goals from backend
- /macrogoals: Lists current macro goals from backend
- /cancel: Cancels current flow (/profile or /newgoal)
- /logout: Clears your saved session

Testing Locally
General checklist
- /start: Ensure the bot prompts for an access code when unauthenticated
- Enter a valid access code: Expect "You are now authenticated."
- /profile: Walk through all questions. Try skip and invalid inputs (e.g., gender typo) to see re-prompt.
- /newgoal: Provide free text, verify suggestions appear. Test "Refine message", selecting a suggestion, and "Cancel".
- /microgoals and /macrogoals: Verify lists show as expected (or the empty-state message)
- /logout: Verify you are prompted for access code again on next message

Sessions
- Sessions persist to .factory/sessions.json
- To reset a user locally, either use /logout or delete their entry in this file while the bot is stopped

Scheduler (daily placeholder check-ins)
- The bot will send "hello" to authenticated users at 09:00 and 19:00 in TZ
- To test without waiting:
  - Temporary method for development only: change the cron expressions in src/lib/scheduler.ts to run every minute (e.g., "*/1 * * * *"), restart the bot, and observe messages. Revert before committing.
  - Or temporarily set TZ to a timezone approaching the scheduled time and restart the bot.

Deploying on AWS EC2
The simplest and resilient approach is to run the bot under a process manager like PM2 on a small Ubuntu instance.

1) Provision an EC2 instance
- AMI: Ubuntu 22.04 LTS (or similar)
- Instance type: t3.micro or larger depending on expected load
- Security Group: Allow SSH (22) from your IP. No inbound ports required for Telegram polling. Outbound HTTPS must be allowed.

2) SSH into the instance and install Node.js
- sudo apt-get update && sudo apt-get upgrade -y
- Install Node.js 18+ (NodeSource example):
  - curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  - sudo apt-get install -y nodejs
- Verify: node -v and npm -v

3) Create a dedicated user and directory
- sudo adduser --system --group compassbot
- sudo mkdir -p /opt/compass-telegram
- sudo chown -R compassbot:compassbot /opt/compass-telegram
- sudo -u compassbot bash
- cd /opt/compass-telegram

4) Pull code and install
- git clone <repo-url> .
- cp .env.example .env and set TELEGRAM_BOT_TOKEN, BACKEND_SHARED_SECRET, BACKEND_BASE_URL (if not default), TZ
- npm install
- npm run generate:backend

5) Choose a runner and start the bot with PM2
Option A: tsx (recommended)
- npm i -D tsx typescript @types/node
- sudo npm i -g pm2
- npx pm2 start "npx tsx src/index.ts" --name compass-bot

Option B: ts-node
- npm i -D ts-node typescript @types/node
- sudo npm i -g pm2
- npx pm2 start "npx ts-node --esm src/index.ts" --name compass-bot

6) Enable PM2 startup and save
- pm2 save
- pm2 startup systemd
- Follow the printed command (sudo env PATH=... pm2 startup ...)
- pm2 save

7) Logs and lifecycle
- View logs: pm2 logs compass-bot
- Restart after changes: pm2 restart compass-bot
- Update procedure:
  - cd /opt/compass-telegram
  - git pull
  - npm ci
  - npm run generate:backend
  - pm2 restart compass-bot

8) Hardening and maintenance
- Ensure .env is readable only by the app user (chmod 600 .env)
- Restrict SSH access by IP, keep system updated
- Consider setting NODE_ENV=production and a proper TZ in .env
- Monitor memory/CPU with pm2 monit or CloudWatch

Testing the UI
A) Test the live Telegram UI (recommended)
- Use the checklist in "Testing Locally" against your deployed bot
- Validate all commands: /start, /profile, /newgoal, /microgoals, /macrogoals, /cancel, /logout
- Verify scheduler messages appear at the expected local times based on TZ

B) View the mock interface (mock-interface.tsx)
The mock files (mock-interface.tsx, mock-interface.css) illustrate the intended UI/UX but are not part of the running bot. To preview them quickly:
Option 1: Quick React sandbox
- Use StackBlitz or CodeSandbox with a React + TypeScript template
- Install lucide-react
- Create a minimal Button component to replace the missing import:
  - Replace the line: import { Button } from "@/components/ui/button"
  - With:
    export function Button(props: any) { return <button {...props} /> }
- The CSS file contains Tailwind directives and design tokens; if your sandbox isn’t configured for Tailwind, you can skip importing mock-interface.css to preview structure and interactions.

Option 2: Local Vite project
- npm create vite@latest mock-ui -- --template react-ts
- cd mock-ui && npm install
- npm install lucide-react
- In src/, add mock-interface.tsx content and a simple Button component as above
- In src/App.tsx, render <ChatInterface />
- If you want styling, integrate Tailwind per Vite+Tailwind docs, then adapt mock-interface.css accordingly. Otherwise, omit styling for a quick functional preview.

Notes
- The bot makes as few decisions as possible and pushes logic to the backend via the generated client.
- Authentication persists between sessions via .factory/sessions.json. Remove with /logout or by deleting the file while the bot is stopped.
- When changing swagger.json, regenerate the client (npm run generate:backend) and restart the bot.
