# Task 1 - Feature 1.1: Initialize Project (Electron + React + TS)

This feature creates the Electron + React + TypeScript scaffolding using electron-vite under src/desktop.

## Overview
- Bootstrap scripts added under scripts/
- Desktop app scaffold under src/desktop/
- Documentation updated under docs/

See docs/apps/desktop/README.md for usage.

## Acceptance Checks
- src/desktop exists with electron.vite.config.ts, tsconfig.json
- Source layout present: src/main, src/preload, src/renderer
- package.json includes scripts: dev, build, preview, lint, typecheck, build:win, build:mac, build:linux
- Dependencies include: electron, electron-vite, react, typescript
- ESLint and Prettier config files present
- .npmrc includes save-exact=true
- .env.example and README.md present in src/desktop
- docs/FILE_ORGANISATION.md mentions src/desktop and outlines key files
- Bootstrap scripts reference electron-vite scaffolding
