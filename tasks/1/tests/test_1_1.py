#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Test Plan ---
# 1. Check for package.json
# 2. Check for required scripts in package.json
# 3. Check for core directory structure
# 4. Check for key config files
# 5. Check for key dependencies

echo "Running acceptance tests for feature 1.1: Initialize Project with electron-vite"

# Criterion 1: A `package.json` file is created in the root directory.
if [ ! -f "package.json" ]; then
  echo "FAIL: package.json not found!"
  exit 1
fi
echo "PASS: package.json found."

# Criterion 2: The `package.json` file contains `dev`, `build`, and `lint` scripts.
package_json_content=$(cat package.json)
if ! echo "$package_json_content" | grep -q '"dev"'; then
  echo "FAIL: 'dev' script not found in package.json"
  exit 1
fi
if ! echo "$package_json_content" | grep -q '"build"'; then
  echo "FAIL: 'build' script not found in package.json"
  exit 1
fi
if ! echo "$package_json_content" | grep -q '"lint"'; then
  echo "FAIL: 'lint' script not found in package.json"
  exit 1
fi
echo "PASS: Required scripts (dev, build, lint) found in package.json."

# Criterion 3: The project directory structure contains `src/main`, `src/preload`, and `src/renderer` subdirectories.
if [ ! -d "src/main" ] || [ ! -d "src/preload" ] || [ ! -d "src/renderer" ]; then
  echo "FAIL: Core directory structure (src/main, src/preload, src/renderer) is missing or incomplete."
  exit 1
fi
echo "PASS: Core directory structure is correct."

# Criterion 4: Configuration files for the toolchain are present.
if [ ! -f "electron.vite.config.ts" ] || [ ! -f ".eslintrc.cjs" ] || [ ! -f "tsconfig.json" ]; then
  echo "FAIL: One or more configuration files (electron.vite.config.ts, .eslintrc.cjs, tsconfig.json) are missing."
  exit 1
fi
echo "PASS: Key configuration files found."

# Criterion 5: The `dependencies` or `devDependencies` in `package.json` include key packages.
# Combine dependencies and devDependencies for easier checking
all_deps=$(cat package.json | grep -E '"(devD|d)ependencies"' -A 10 | tr -d '\n\r ')

if ! echo "$all_deps" | grep -q '"electron"'; then
  echo "FAIL: 'electron' dependency not found in package.json"
  exit 1
fi
if ! echo "$all_deps" | grep -q '"electron-vite"'; then
  echo "FAIL: 'electron-vite' dependency not found in package.json"
  exit 1
fi
if ! echo "$all_deps" | grep -q '"react"'; then
  echo "FAIL: 'react' dependency not found in package.json"
  exit 1
fi
if ! echo "$all_deps" | grep -q '"typescript"'; then
  echo "FAIL: 'typescript' dependency not found in package.json"
  exit 1
fi
echo "PASS: Key dependencies (electron, electron-vite, react, typescript) found in package.json."

echo "All acceptance criteria for feature 1.1 met."
exit 0
