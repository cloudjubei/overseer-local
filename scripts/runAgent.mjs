#!/usr/bin/env node
// Simple CLI to start a factory-ts run and stream JSONL events to stdout.
// Requires the local package to be built: npm run factory:build

import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.project || (!args.task && !args.feature)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  // Import from built dist
  const pkgPath = path.resolve(__dirname, '../packages/factory-ts/dist/index.js');
  let factory;
  try {
    factory = await import(url.pathToFileURL(pkgPath).href);
  } catch (err) {
    console.error('Failed to load factory-ts dist. Build it first with: npm run factory:build');
    console.error(err?.stack || String(err));
    process.exit(1);
  }

  const { runTask, runFeature, electronShim } = factory;

  const projectId = args.project;
  const taskId = args.task;
  const featureId = args.feature;

  const handle = featureId != null
    ? runFeature({ projectId, taskId: taskId ?? 'unknown', featureId })
    : runTask({ projectId, taskId: taskId ?? 'unknown' });

  // Stream JSONL
  for await (const line of electronShim.streamJSONL(handle)) {
    process.stdout.write(line);
  }
}

function parseArgs(argv) {
  const out = { help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') out.help = true;
    else if ((a === '-p' || a === '--project') && i + 1 < argv.length) out.project = argv[++i];
    else if ((a === '-t' || a === '--task') && i + 1 < argv.length) out.task = argv[++i];
    else if ((a === '-f' || a === '--feature') && i + 1 < argv.length) out.feature = argv[++i];
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node scripts/runAgent.mjs -p <projectId> [-t <taskId>] [-f <featureId>]\n\nExamples:\n  node scripts/runAgent.mjs -p demo -t 7\n  node scripts/runAgent.mjs -p demo -t 7 -f 7.2`);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
