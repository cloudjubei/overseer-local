#!/usr/bin/env node
/**
 * Format all files in the repository using Prettier.
 * This script respects .prettierrc.json and .prettierignore.
 */

const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

const prettierBin = process.platform === 'win32'
  ? join(process.cwd(), 'node_modules', '.bin', 'prettier.cmd')
  : join(process.cwd(), 'node_modules', '.bin', 'prettier');

if (!existsSync(prettierBin)) {
  console.error('Prettier binary not found. Please run `npm install` first.');
  process.exit(1);
}

const args = ['--write', '.'];

const child = spawn(prettierBin, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code));
