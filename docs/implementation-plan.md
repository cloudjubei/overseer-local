# Implementation plan

For the architectural ground rules every change must follow, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the platform-adaptation rules see [PLATFORM_ADAPTATIONS.md](./PLATFORM_ADAPTATIONS.md) and [MULTI_PLATFORM_ARCHITECTURE.md](./MULTI_PLATFORM_ARCHITECTURE.md). For the UI conventions, see the canonical home at [thefactory-ui/docs/ARCHITECTURE.md § Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions). For the build/sign/publish pipeline see [DEPLOYMENT.md](./DEPLOYMENT.md). The reference implementation to mirror is [thefactory-overseer-web](../../thefactory-overseer-web)'s renderer.

---

## A. Open questions / blocked tasks

Things genuinely blocked on a third-party decision or external trigger, not on engineering work.

1. **Production deployment.** End-to-end plan in [DEPLOYMENT.md](./DEPLOYMENT.md). Blocked on Apple Developer ID cert, Windows code-signing cert, and an AWS account / bucket. No engineering work to start until at least one of those lands.
2. **OS-level push notifications via the backend.** The in-process `Notification` API already covers in-app notifications; the cross-device "you have a chat reply" story (consistent across web / desktop / mobile) lives in [thefactory-backend/docs/implementation-plan.md](../../thefactory-backend/docs/implementation-plan.md). Land it there, surface it here.
3. **Multi-user real-time collaboration on the same project.** Backend supports it; no client surfaces presence / multi-cursor / live-edit UX. Single-user-multiple-clients (same user, web + desktop + mobile) is the supported model.
4. **Offline writes with later sync.** Real sync engines (CRDTs, OT, git-merge orchestration in UI) are months of work; revisit only if real usage shows the always-online assumption is untenable.

---

## Non-goals (don't accept scope creep here)

- A bundled / sidecar backend. The backend runs separately; see [ARCHITECTURE.md](./ARCHITECTURE.md).
- Bundling Postgres / pglite / docker-compose hints.
- Data migration from the old LOCAL `~/.factory/` layout. Fresh-start assumption.
- A dual-mode LOCAL + CONNECTED runtime. Single mode: CONNECTED.
- A custom transport between Electron and the backend. HTTP + WS is the contract — same one web uses.
- Replacing the IPC bridge with direct HTTP from the renderer for **everything**. IPC stays for the Electron-only native surfaces (window controls, native menus, file pickers, deep links). Data goes straight over HTTP + WS.
- A separate "headless" Electron build for CI / scripting. The CLI is `thefactory-cli` against the backend — see [docs/expansion/04-cli-integration.md](./expansion/04-cli-integration.md).
- Tests for UI components in the renderer. Same rule as the other frontend clients — typecheck + build + manual run. Tests live in `thefactory-ui/headless` and the backend.
