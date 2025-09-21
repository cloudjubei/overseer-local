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

- To build the app for production:
  ```bash
  npm run build
  ```
  The built artifacts will be in the `dist` directory.

## Project Structure

- `src/`: Main application source code (Electron, React, TypeScript).
- `docs/`: Documentation files.
- `.stories/`: Story-related metadata and tests.
- `scripts/`: Automation scripts.

For more details on file organization, see `docs/FILE_ORGANISATION.md`.

## Troubleshooting

- If you encounter issues with dependencies, try deleting `node_modules` and running `npm install` again.
- Ensure your Node.js version is compatible.
