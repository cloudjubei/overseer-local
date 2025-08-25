# Linting and Formatting Setup

## Overview
- ESLint: Static analysis for JS/TS with React and Electron contexts
- Prettier: Consistent code formatting
- Husky: Git hooks to enforce checks on commits
- lint-staged: Run linters only on changed files for speed

## Setup
- Run the one-shot script: node scripts/setup-linting-formatting.js
- The script installs dev dependencies, writes config files, updates package.json, sets up Husky, and adds a CI workflow

Usage
- npm run lint: Run ESLint on the repository
- npm run lint:fix: Fix lint issues automatically
- npm run format: Write Prettier formatting to files
- npm run format:check: Check formatting without writing

Pre-commit Hook
- On commit, lint-staged runs ESLint and Prettier on staged files
- To bypass hooks (not recommended): git commit --no-verify

Electron Contexts
- ESLint overrides configure browser env for src/renderer and node env for src/main and src/preload
- This reduces false positives across the Electron process boundaries

Path Aliases
- If tsconfig paths are introduced, consider adding eslint-import-resolver-typescript or adjust simple-import-sort grouping to match your alias conventions

CI
- .github/workflows/lint.yml runs ESLint and Prettier checks on push and PR to main
- If CI fails, run the same commands locally to troubleshoot: npm run lint and npm run format:check
