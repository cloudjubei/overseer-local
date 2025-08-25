#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Test Plan ---
# 1. Verify project structure and key configuration files exist.
# 2. Verify package.json contains the required scripts.
# 3. Install dependencies.
# 4. Run the linter to verify ESLint setup.
# 5. Run the build command to ensure it completes successfully.
# 6. Check for the build output directory.

echo "--- 1. Verifying project structure and configuration files ---"
if [ ! -d "src/main" ] || [ ! -d "src/preload" ] || [ ! -d "src/renderer" ]; then
    echo "FAIL: Expected src/main, src/preload, and src/renderer directories not found."
    exit 1
fi
echo "PASS: Source directories exist."

if [ ! -f "electron.vite.config.ts" ] || [ ! -f ".eslintrc.cjs" ] || [ ! -f "tsconfig.json" ] || [ ! -f "package.json" ]; then
    echo "FAIL: Expected configuration files (electron.vite.config.ts, .eslintrc.cjs, tsconfig.json, package.json) not found."
    exit 1
fi
echo "PASS: Configuration files exist."

echo "--- 2. Verifying scripts in package.json ---"
if ! grep -q '"dev":' package.json || ! grep -q '"build":' package.json || ! grep -q '"lint":' package.json || ! grep -q '"format":' package.json; then
    echo "FAIL: Required scripts (dev, build, lint, format) not found in package.json."
    exit 1
fi
echo "PASS: Required scripts found in package.json."

echo "--- 3. Installing dependencies ---"
if ! command -v pnpm &> /dev/null
then
    echo "pnpm could not be found, installing..."
    npm install -g pnpm
fi
pnpm install
echo "PASS: Dependencies installed."

echo "--- 4. Running linter ---"
pnpm run lint
echo "PASS: Lint command executed successfully."

echo "--- 5. Running build command ---"
pnpm run build
echo "PASS: Build command executed successfully."

echo "--- 6. Verifying build output ---"
if [ ! -d "out" ]; then
    echo "FAIL: Build output directory 'out' not found after build."
    exit 1
fi
echo "PASS: Build output directory exists."

echo "--- ALL TESTS PASSED ---"
exit 0
