# Desktop App (Electron + React + TypeScript)

This app is scaffolded with electron-vite using the React + TypeScript template.

## Prerequisites
- Node.js >= 18

## Setup
From repository root:
- node scripts/bootstrap_desktop_app.mjs

Or manually install inside src/desktop:
- pnpm install  (or npm install)

## Commands (run inside src/desktop)
- Dev: pnpm dev  (or npm run dev)
- Build: pnpm build  (or npm run build)
- Preview: pnpm preview  (or npm run preview)
- Lint: pnpm lint  (or npm run lint)
- Typecheck: pnpm typecheck  (or npm run typecheck)
- Build (platform-specific): pnpm build:win | build:mac | build:linux

## Troubleshooting
- If dev server fails, remove node_modules and reinstall.
- Permission denied on shell scripts: chmod +x scripts/bootstrap_desktop_app.sh
- Clear caches if issues persist: rm -rf node_modules .vite; reinstall.
