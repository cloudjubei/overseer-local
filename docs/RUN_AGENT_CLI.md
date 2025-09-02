# Run Agent CLI (local)

This repository integrates the local packages/factory-ts library and exposes a simple CLI to start a run and stream JSONL events.

Build the package once:
- npm run factory:build

Run examples:
- node scripts/runAgent.mjs -p demo -t 7
- node scripts/runAgent.mjs -p demo -t 7 -f 7.2

Output protocol:
- One JSON object per line (JSONL), each matching the RunEvent union emitted by factory-ts (see packages/factory-ts/FACTORY_TS_OVERVIEW.md).

Notes:
- The current orchestrator emits a minimal simulated lifecycle suitable for wiring and monitoring. Replace with a real agent engine as factory-ts evolves.
