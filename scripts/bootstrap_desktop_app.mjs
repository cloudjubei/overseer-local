import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';

async function run(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options });
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const err = new Error(`${cmd} ${args.join(' ')} exited with code ${code}`);
      err.code = code;
      reject(err);
    });
  });
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJSON(p) {
  const s = await fs.readFile(p, 'utf8');
  return JSON.parse(s);
}

async function writeJSON(p, obj) {
  await fs.writeFile(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

async function ensureLineInFile(p, line) {
  let content = '';
  if (await fileExists(p)) content = await fs.readFile(p, 'utf8');
  if (!content.split(/\r?\n/).some((l) => l.trim() === line)) {
    const prefix = content && !content.endsWith('\n') ? '\n' : '';
    await fs.writeFile(p, content + prefix + line + '\n', 'utf8');
  }
}

async function detectPackageManager(cwd) {
  async function hasCmd(cmd) {
    try {
      await run(cmd, ['--version'], { cwd });
      return true;
    } catch {
      return false;
    }
  }
  if (await hasCmd('pnpm')) {
    return { name: 'pnpm', install: ['pnpm', ['install']], exec: (args) => ['pnpm', args] };
  }
  return { name: 'npm', install: ['npm', ['install']], exec: (args) => ['npm', ['run', ...args]] };
}

async function ensureScaffold(repoRoot, targetDir) {
  const exists = await fileExists(targetDir);
  if (!exists) {
    console.log('Scaffolding Electron + React + TS app using electron-vite...');
    try {
      await run('npx', ['--yes', 'create-electron-vite@latest', 'src/desktop', '--template', 'react-ts'], { cwd: repoRoot });
    } catch (e) {
      console.error('Failed to scaffold with create-electron-vite. You can retry manually:');
      console.error('npx --yes create-electron-vite@latest src/desktop --template react-ts');
      throw e;
    }
  } else {
    console.log('Found existing src/desktop. Skipping scaffold.');
  }
}

function mergeScripts(existing, required) {
  return { ...existing, ...required };
}

function ensureDeps(pkg, ensure) {
  pkg.dependencies = pkg.dependencies || {};
  pkg.devDependencies = pkg.devDependencies || {};
  const missing = [];
  for (const dep of ensure.dependencies || []) {
    if (!pkg.dependencies[dep] && !pkg.devDependencies[dep]) missing.push(dep);
  }
  for (const dep of ensure.devDependencies || []) {
    if (!pkg.dependencies[dep] && !pkg.devDependencies[dep]) missing.push(dep);
  }
  return missing;
}

async function ensureConfigFiles(targetDir) {
  const eslintrc = path.join(targetDir, '.eslintrc.cjs');
  if (!(await fileExists(eslintrc))) {
    const content = `module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  settings: { react: { version: 'detect' } },
};
`;
    await fs.writeFile(eslintrc, content, 'utf8');
  }
  const prettierrc = path.join(targetDir, '.prettierrc.json');
  if (!(await fileExists(prettierrc))) {
    await fs.writeFile(prettierrc, JSON.stringify({ singleQuote: true, semi: true, tabWidth: 2, trailingComma: 'es5', printWidth: 100 }, null, 2) + '\n', 'utf8');
  }
  const npmrc = path.join(targetDir, '.npmrc');
  await ensureLineInFile(npmrc, 'save-exact=true');

  const envExample = path.join(targetDir, '.env.example');
  if (!(await fileExists(envExample))) {
    await fs.writeFile(envExample, 'VITE_APP_TITLE=Desktop App\n', 'utf8');
  }

  const readme = path.join(targetDir, 'README.md');
  if (!(await fileExists(readme))) {
    await fs.writeFile(
      readme,
      `# Desktop App (Electron + React + TypeScript)

This app is scaffolded with electron-vite using the React + TypeScript template.

## Prerequisites
- Node.js >= 18

## Setup
- Install dependencies: use pnpm or npm

Using pnpm:
- pnpm install

Using npm:
- npm install

## Development
- pnpm dev  (or npm run dev)

## Build
- pnpm build  (or npm run build)
- pnpm build:win | build:mac | build:linux

## Preview
- pnpm preview  (or npm run preview)

## Lint
- pnpm lint  (or npm run lint)

## Typecheck
- pnpm typecheck  (or npm run typecheck)
`,
      'utf8'
    );
  }
}

async function maybePatchElectronViteConfig(targetDir) {
  const cfgPath = path.join(targetDir, 'electron.vite.config.ts');
  if (!(await fileExists(cfgPath))) return; // don't create; only patch if exists
  let content = await fs.readFile(cfgPath, 'utf8');
  const hasProductName = /productName\s*:\s*['"][^'"]+['"]/m.test(content);
  const hasAppId = /appId\s*:\s*['"][^'"]+['"]/m.test(content);
  if (!hasProductName || !hasAppId) {
    // Try to inject under top-level defineConfig({ ... }) root
    if (/defineConfig\(/.test(content)) {
      content = content.replace(/defineConfig\(\{/, (m) => {
        return `defineConfig({\n  productName: 'DesktopApp',\n  appId: 'com.example.desktopapp',`;
      });
      await fs.writeFile(cfgPath, content, 'utf8');
    }
  }
}

async function main() {
  const repoRoot = process.cwd();
  const targetDir = path.join(repoRoot, 'src', 'desktop');

  await ensureScaffold(repoRoot, targetDir);

  const pm = await detectPackageManager(targetDir);

  // Ensure install
  try {
    console.log(`Installing dependencies in ${path.relative(repoRoot, targetDir)} using ${pm.name}...`);
    await run(pm.install[0], pm.install[1], { cwd: targetDir });
  } catch (e) {
    console.warn('Dependency installation failed; continuing with configuration steps.');
  }

  const pkgPath = path.join(targetDir, 'package.json');
  if (!(await fileExists(pkgPath))) {
    console.warn('package.json not found in src/desktop. Creating a minimal one.');
    await writeJSON(pkgPath, { name: 'desktop-app', private: true, version: '0.0.0' });
  }
  const pkg = await readJSON(pkgPath);

  // Ensure scripts
  pkg.scripts = mergeScripts(pkg.scripts || {}, {
    dev: 'electron-vite dev',
    build: 'electron-vite build',
    'build:win': 'electron-vite build --win',
    'build:mac': 'electron-vite build --mac',
    'build:linux': 'electron-vite build --linux',
    preview: 'electron-vite preview',
    lint: 'eslint .',
    typecheck: 'tsc --noEmit',
  });

  // Ensure required deps exist
  const missing = ensureDeps(pkg, {
    dependencies: ['react'],
    devDependencies: ['electron', 'electron-vite', 'typescript'],
  });

  await writeJSON(pkgPath, pkg);

  // Install missing deps
  if (missing.length) {
    try {
      console.log('Installing missing dependencies:', missing.join(', '));
      await run(pm.install[0], ['install', ...missing, '--save-dev'], { cwd: targetDir });
    } catch (e) {
      console.warn('Failed to install some dependencies:', missing.join(', '));
    }
  }

  // Ensure ESLint/Prettier configs
  await ensureConfigFiles(targetDir);

  // Patch electron.vite.config.ts if needed
  await maybePatchElectronViteConfig(targetDir);

  console.log('\nAll set!');
  console.log('Next steps:');
  console.log(`  cd ${path.relative(repoRoot, targetDir)} && ${pm.name === 'pnpm' ? 'pnpm' : 'npm run'} dev`);
  console.log('Build commands: build, build:win, build:mac, build:linux');
}

main().catch((err) => {
  console.error(err);
  process.exit(typeof err.code === 'number' ? err.code : 1);
});
