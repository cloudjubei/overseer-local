# Desktop Application (Electron + React + TypeScript)

This is an Electron desktop application scaffolded by electron-vite using the React + TypeScript template. It lives under src/desktop/.

## Prerequisites
- Node.js >= 18

## Setup
From the repository root, you can run the bootstrap script (idempotent):
- node scripts/bootstrap_desktop_app.mjs

Alternatively, manually install dependencies inside src/desktop:
- pnpm install  (or npm install)

## Commands (run inside src/desktop)
- Development: pnpm dev  (or npm run dev)
- Build: pnpm build  (or npm run build)
- Preview: pnpm preview  (or npm run preview)
- Lint: pnpm lint  (or npm run lint)
- Typecheck: pnpm typecheck  (or npm run typecheck)
- Platform builds: pnpm build:win | build:mac | build:linux

## Structure
- electron.vite.config.ts: electron-vite configuration
- tsconfig.json: TypeScript configuration
- src/main: Electron main process
- src/preload: Preload scripts
- src/renderer: React renderer (index.html + React app)

## Troubleshooting
- If dependencies fail to install, delete node_modules and try again.
- On Unix, ensure scripts are executable: chmod +x scripts/bootstrap_desktop_app.sh
- Clear build caches: remove src/desktop/.vite or out/ directories if needed.
- Ensure your Node.js version is >= 18.
