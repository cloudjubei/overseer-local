# overseer-local

Overseer - Local App used for story and project orchestration [TheFactory-Child]

## Overview

This is an Electron desktop application built with React and TypeScript using the electron-vite toolchain. It serves as a local app for story and project orchestration.

## Prerequisites

- Node.js (version 16 or higher recommended)
- npm (comes with Node.js)
- Git

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd overseer-local
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Running the App

- For development mode (with hot reloading):
  ```bash
  npm run dev
  ```
  This will start the Electron app in development mode.

## Building the App

- To build the sources (typecheck + electron-vite) into `out/`:
  ```bash
  npm run build
  ```

### Build a local app (macOS)

`thefactory-tools` and `thefactory-ui` are `file:` links to the sibling folders, the same way thefactory-backend uses them, so build them first:

```bash
(cd ../thefactory-tools && npm run build)
(cd ../thefactory-ui && npm run build)
npm run build:mac
```

This gives an unsigned `dist/Overseer-<version>-arm64.dmg` and `dist/mac-arm64/Overseer.app`. `npm run build:unpack` builds only the `.app`, faster. Signing turns on only when signing env vars are set. See [docs/APP_RELEASE.md](docs/APP_RELEASE.md#build-locally) and [docs/BUILD_SIGNING.md](docs/BUILD_SIGNING.md).

## Project Structure

- `src/`: Main application source code (Electron, React, TypeScript).
- `docs/`: Documentation files.
- `.stories/`: Story-related metadata and tests.
- `scripts/`: Automation scripts.

For more details on file organization, see `docs/FILE_ORGANISATION.md`.

## Troubleshooting

- If you encounter issues with dependencies, try deleting `node_modules` and running `npm install` again.
- Ensure your Node.js version is compatible.
