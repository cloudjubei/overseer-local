"use strict";
/**
 * Setup linting and formatting for Electron + React + TypeScript repo.
 * - Installs dev deps (ESLint, Prettier, Husky, lint-staged, plugins)
 * - Writes config files (.editorconfig, .prettierrc.json, .eslintignore, .eslintrc.cjs)
 * - Updates package.json scripts and lint-staged config
 * - Initializes Husky and pre-commit hook
 * - Adds optional CI workflow if missing
 *
 * Run: node scripts/setup-linting-formatting.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function hasFile(p) {
  return fs.existsSync(path.resolve(p));
}

function readJSON(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeFileIfDifferent(file, content) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (existing === content) return false;
  }
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function detectPkgManager() {
  if (hasFile('pnpm-lock.yaml')) return { name: 'pnpm', addDev: 'pnpm add -D', dlx: 'pnpm dlx' };
  if (hasFile('yarn.lock')) return { name: 'yarn', addDev: 'yarn add -D', dlx: 'yarn dlx' };
  if (hasFile('bun.lockb')) return { name: 'bun', addDev: 'bun add -d', dlx: 'bunx' };
  return { name: 'npm', addDev: 'npm i -D', dlx: 'npx' };
}

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function ensureDevDeps(pm) {
  const devDeps = [
    'eslint',
    '@typescript-eslint/parser',
    '@typescript-eslint/eslint-plugin',
    'eslint-plugin-react',
    'eslint-plugin-react-hooks',
    'eslint-plugin-jsx-a11y',
    'eslint-plugin-simple-import-sort',
    'eslint-plugin-unused-imports',
    'eslint-plugin-prettier',
    'eslint-config-prettier',
    'prettier',
    'eslint-plugin-n',
    'eslint-plugin-vitest',
    'husky',
    'lint-staged'
  ];
  run(`${pm.addDev} ${devDeps.join(' ')}`);
}

function ensureConfigFiles() {
  const files = [
    {
      file: '.editorconfig',
      content: `root = true\n[*]\nindent_style = space\nindent_size = 2\nend_of_line = lf\ncharset = utf-8\ntrim_trailing_whitespace = true\ninsert_final_newline = true\n[*.md]\ntrim_trailing_whitespace = false\n`,
    },
    {
      file: '.prettierrc.json',
      content: `{"printWidth":100,"tabWidth":2,"singleQuote":true,"trailingComma":"all","semi":true,"arrowParens":"always","bracketSpacing":true,"endOfLine":"lf"}\n`,
    },
    {
      file: '.prettierignore',
      content: `node_modules\ndist\nbuild\nout\ncoverage\n.husky\n.github\n.next\n.cache\n.turbo\n.vite\n`,
    },
    {
      file: '.eslintignore',
      content: `node_modules\ndist\nbuild\nout\ncoverage\n.husky\n.github\n.next\n.cache\n.turbo\n.vite\n`,
    },
    {
      file: '.eslintrc.cjs',
      content: `module.exports = {\n  root: true,\n  env: { es2023: true },\n  parser: '@typescript-eslint/parser',\n  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },\n  plugins: [\n    '@typescript-eslint',\n    'react',\n    'react-hooks',\n    'jsx-a11y',\n    'simple-import-sort',\n    'unused-imports',\n    'prettier',\n    'n',\n    'vitest'\n  ],\n  extends: [\n    'eslint:recommended',\n    'plugin:@typescript-eslint/recommended',\n    'plugin:react/recommended',\n    'plugin:react-hooks/recommended',\n    'plugin:jsx-a11y/recommended',\n    'plugin:n/recommended',\n    'plugin:vitest/recommended',\n    'plugin:prettier/recommended',\n    'prettier'\n  ],\n  settings: { react: { version: 'detect' } },\n  rules: {\n    'prettier/prettier': 'error',\n    'no-console': 'warn',\n    'no-debugger': 'warn',\n    'unused-imports/no-unused-imports': 'error',\n    '@typescript-eslint/no-unused-vars': [\n      'warn',\n      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }\n    ],\n    'simple-import-sort/imports': 'warn',\n    'simple-import-sort/exports': 'warn',\n    'react/react-in-jsx-scope': 'off'\n  },\n  overrides: [\n    { files: ['src/renderer/**/*.{ts,tsx,js,jsx}'], env: { browser: true } },\n    { files: ['src/main/**/*.{ts,js}', 'src/preload/**/*.{ts,js}', '*.config.{ts,js,mjs,cjs}'], env: { node: true } },\n    { files: ['**/*.{test,spec}.{ts,tsx,js,jsx}'], env: { 'vitest/globals': true } }\n  ],\n  ignorePatterns: ['dist', 'build', 'out', 'node_modules', '.husky']\n};\n`,
    },
  ];
  let wrote = 0;
  files.forEach(({ file, content }) => {
    if (writeFileIfDifferent(file, content)) wrote++;
  });
  return wrote;
}

function ensurePackageJson(pm) {
  const pkgPath = path.resolve('package.json');
  let pkg = readJSON(pkgPath) || { name: 'app', version: '0.0.0', private: true };
  pkg.scripts = pkg.scripts || {};
  const desiredScripts = {
    lint: 'eslint . --ext .cjs,.mjs,.js,.ts,.tsx',
    'lint:fix': 'npm run lint -- --fix',
    format: 'prettier --write .',
    'format:check': 'prettier --check .',
    prepare: 'husky install',
  };
  let changed = false;
  for (const [k, v] of Object.entries(desiredScripts)) {
    if (!pkg.scripts[k]) {
      pkg.scripts[k] = v;
      changed = true;
    }
  }

  const desiredLintStaged = {
    '*.{js,jsx,ts,tsx,cjs,mjs}': ['eslint --fix'],
    '*.{json,css,scss,md,yml,yaml,html}': ['prettier --write'],
  };
  if (!pkg['lint-staged']) {
    pkg['lint-staged'] = desiredLintStaged;
    changed = true;
  } else {
    // merge keys conservatively
    for (const [k, v] of Object.entries(desiredLintStaged)) {
      if (!pkg['lint-staged'][k]) {
        pkg['lint-staged'][k] = v;
        changed = true;
      }
    }
  }

  if (changed || !fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return pkg;
}

function ensureHusky(pm) {
  try {
    // Install husky (ensure .husky folder exists and is initialized)
    run(`${pm.dlx} husky install`);
  } catch (e) {
    console.warn('Husky install failed. Continuing...');
  }
  const hook = `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${pm.dlx === 'npx' ? 'npx' : pm.dlx} --no-install lint-staged\n`;
  const hookPath = path.resolve('.husky', 'pre-commit');
  writeFileIfDifferent(hookPath, hook);
  try {
    fs.chmodSync(hookPath, 0o755);
  } catch {}
}

function ensureCIWorkflow() {
  const workflowPath = path.resolve('.github', 'workflows', 'lint.yml');
  if (fs.existsSync(workflowPath)) return false;
  const content = `name: Lint and Format\n on:\n  pull_request:\n  push:\n    branches: [ main ]\n jobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - name: Install dependencies\n        run: |\n          if [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i; \\\n          elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\\n          elif [ -f bun.lockb ]; then curl -fsSL https://bun.sh/install | bash && bun install; \\\n          else npm ci; fi\n      - name: ESLint\n        run: npm run lint\n      - name: Prettier (check)\n        run: npm run format:check\n`;
  writeFileIfDifferent(workflowPath, content);
  return true;
}

(function main() {
  console.log('Setting up linting and formatting...');
  const pm = detectPkgManager();
  try {
    ensureDevDeps(pm);
  } catch (e) {
    console.warn('Dependency installation failed. You may need to install manually:', e.message);
  }
  const filesWritten = ensureConfigFiles();
  const pkg = ensurePackageJson(pm);
  ensureHusky(pm);
  const ciAdded = ensureCIWorkflow();

  console.log('\nSummary:');
  console.log(`- Package manager: ${pm.name}`);
  console.log(`- Config files written/updated: ${filesWritten}`);
  console.log(`- package.json scripts: ${Object.keys(pkg.scripts || {}).join(', ')}`);
  console.log(`- lint-staged configured: ${!!pkg['lint-staged']}`);
  console.log(`- CI workflow added: ${ciAdded}`);
  console.log('\nNext steps:');
  console.log('- Verify: npm run lint && npm run format:check');
  console.log('- Husky pre-commit hook will run lint-staged on commits.');
})();
