# `src/legacy/`

Frozen snapshot of the in-process LOCAL implementation that backed desktop before the backend-only cutover (2026-05). Kept verbatim for reference — algorithms, edge-case handling, data shapes, file-watcher patterns we may want to recall later when re-implementing equivalent surfaces in [`thefactory-backend`](../../../thefactory-backend) or when investigating historical behaviour.

## Contents

- `legacy/logic/` — the former `src/logic/` tree (BaseManager + per-domain managers + storage helpers).
- `legacy/main/managers.ts` — the wiring file that constructed and initialised every manager from the main process.

Folder structure mirrors the old `src/` tree so a reader can navigate it like the original codebase. Imports inside this tree are likely dangling (e.g. `../../preload/ipcHandlersKeys`, `../../types/settings`) — that's expected: this directory is excluded from the build, typecheck, lint and tests.

## Rules

- **Nothing in live code may import from `src/legacy/`.** The build excludes it; `tsconfig.node.json` and `tsconfig.web.json` `exclude` it; ESLint ignores it; no tests run against it.
- **Don't add new code here.** This is a frozen reference, not an active surface. If a piece of legacy code becomes load-bearing again, port it into live code with a clean home (most likely into [`thefactory-backend`](../../../thefactory-backend)) and delete the legacy copy.
- **Don't fix dangling imports.** They are not bugs — they reflect the fact that the surrounding `src/preload/` / `src/types/` are still live and were intentionally left in place. Use grep to follow a reference if you need to.

## Why this exists

Desktop is moving to a pure backend client: renderer → `thefactory-backend` over HTTP + WS, main process keeps only Electron chrome. The migration plan is in [`docs/implementation-plan.md`](../../docs/implementation-plan.md) (§ B.1 covers this move). The architecture overview pointing at this directory is in [`docs/ARCHITECTURE.md` § `src/legacy/`](../../docs/ARCHITECTURE.md#srclegacy).
