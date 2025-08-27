'use strict';
/**
 * CLI for preview analyzer.
 * Usage:
 *   node scripts/preview-scan.js --dir src/renderer/components --out preview-metadata.json
 *
 * Outputs a JSON report with per-file analysis and a summary section.
 */
const fs = require('fs');
const path = require('path');
const { analyzeDirectory } = require('../src/tools/preview/analyzer');

function parseArgs(argv) {
  const args = { dir: 'src/renderer/components', out: null, pretty: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir') args.dir = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--compact') args.pretty = false;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/preview-scan.js --dir <src/renderer/components> [--out <file>] [--compact]');
      process.exit(0);
    }
  }
  return args;
}

(function main() {
  const args = parseArgs(process.argv);
  const dir = path.resolve(args.dir);
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }
  const report = analyzeDirectory(dir);
  const json = args.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report);
  if (args.out) {
    const outPath = path.resolve(args.out);
    fs.writeFileSync(outPath, json, 'utf8');
    console.log(`Preview analysis written to ${outPath}`);
  } else {
    console.log(json);
  }
})();
