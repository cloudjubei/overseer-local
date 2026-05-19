# Implementation plan

For the architectural ground rules every change must follow, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the platform-adaptation rules see [PLATFORM_ADAPTATIONS.md](./PLATFORM_ADAPTATIONS.md) and [MULTI_PLATFORM_ARCHITECTURE.md](./MULTI_PLATFORM_ARCHITECTURE.md). For the UI conventions, see the canonical home at [thefactory-ui/docs/ARCHITECTURE.md § Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions). The reference implementation to mirror is [thefactory-overseer-web](../../thefactory-overseer-web)'s renderer.

---

## Cross-client parity mandate (absolute requirement)

This is non-negotiable and applies equally to this app, [thefactory-overseer-web](../../thefactory-overseer-web), [thefactory-overseer-mobile](../../thefactory-overseer-mobile), and the shared [thefactory-ui](../../thefactory-ui).

**The three frontend clients — web, desktop, mobile — must mirror each other as closely as the host platform allows.** Side-by-side, they should read like the same app adapted to its surface, not three independent products. Concretely:

- **Shared spine is [thefactory-ui](../../thefactory-ui).** Tokens, headless hooks/stores, business logic, contexts, badge math, sanitisers, form state machines — all live there. Each client is mostly presentation glue around the shared spine.
- **File layout, screen names, navigation structure, context names, hook names match across clients.** Desktop's `src/renderer/ui/screens/StoriesScreen.tsx` and the equivalent web/mobile paths read the same.
- **Divergences are explicit and justified.** Electron-specific chrome (native menus, system tray, OS notifications) is accepted divergence; gratuitous divergence is not. When desktop needs to drift, the drift is documented at the call site with a comment pointing to the equivalent code in web/mobile.
- **Cross-client changes land together.** If a feature touches the chat surface, all three clients ship the change in the same release window. New shared code goes into `thefactory-ui` first; clients pull it in.

A new contributor opening web, desktop, and mobile side by side should be able to navigate by analogy. If they can't, something has drifted and the drift needs to be fixed.

---

## A. Open questions / blocked tasks

Things genuinely blocked on a third-party decision or external trigger, not on engineering work. Re-populate only when a real external blocker appears.

*(Currently empty.)*

---

## B. Pending tasks

### 1. Smoke-test signed installers against a live backend

The backend-only cutover (2026-05) shipped clean typecheck / tests / build. The last open item is a manual smoke test of `electron-builder` output on each target OS:

- macOS — `npm run build:mac`, install the DMG, paste backend URL + token, navigate stories + chats.
- Windows — `npm run build:win`, install the NSIS installer, repeat.
- Linux — `npm run build:linux`, install the AppImage / snap / deb, repeat.

Confirm the renderer reaches the backend, the WS connects, and disconnect-banner appears when the backend is stopped mid-session.

---

## C. Runtime model

- **Backend-only, always online, fresh start.** Desktop is a pure backend client — equivalent to web at the runtime level and to mobile at the deployment-target level.
- **Renderer talks to `thefactory-backend` over HTTP + WS**, exactly like web. Same generated SDK, same WS event stream.
- **Main process is window chrome + native bridges only** — no data services, no file watchers, no embedded Node runtime, no Postgres, no sidecar, no bundled backend. The user runs (or connects to) a `thefactory-backend` instance separately.
- **No backward compatibility, no data migration.** Existing `~/.factory/` trees are not auto-imported; this is treated as a fresh install.
- **No offline mode, no local cache, no sync layer.** Network drops show a disconnected banner ([`DisconnectedBanner`](../src/renderer/src/ui/components/shell/DisconnectedBanner.tsx)); data screens stay on their last-known render.
- **What stays Electron-side:** window controls, native menus, system tray, OS notifications, native file pickers, app-protocol handlers, settings + theme state (UI-level only — same `AppSettings` / `chatsSeen` localStorage model the web uses). IPC stays for these surfaces; everything else is direct HTTP + WS.

---

## Deferred items

Real work, but explicitly out of scope until a trigger arrives.

- **OS-level push notifications via the backend.** The Electron `Notification` API already covers in-process notifications; the cross-device "you have a chat reply" story (consistent across desktop / mobile / web) lives in [thefactory-backend/docs/implementation-plan.md](../../thefactory-backend/docs/implementation-plan.md)'s deferred-items section. Land it there, surface it here.
- **Multi-user real-time collaboration on the same project.** Backend supports it; desktop doesn't surface multi-cursor / presence / live-edit UX. Single-user-multiple-clients (same user, web + desktop + mobile) is the supported model.
- **Offline writes with later sync.** Genuine sync engines (CRDTs, OT, git-merge orchestration in UI) are months of work; revisit only if real usage shows the always-online assumption is untenable.

---

## Non-goals (don't accept scope creep here)

- A bundled / sidecar backend. See §C.
- Bundling Postgres / pglite / docker-compose hints. The backend runs separately.
- Data migration from the old LOCAL `~/.factory/` layout. Fresh-start assumption.
- A dual-mode LOCAL + CONNECTED runtime. Single mode: CONNECTED.
- A custom transport between Electron and the backend. HTTP + WS is the contract — same one web uses.
- Replacing the IPC bridge with direct HTTP from the renderer for **everything**. IPC stays for the Electron-only native surfaces (window controls, native menus, file pickers, deep links). Data goes straight over HTTP + WS.
- A separate "headless" Electron build for CI / scripting. The CLI is `thefactory-cli` against the backend — see [docs/expansion/04-cli-integration.md](./expansion/04-cli-integration.md).
- Tests for UI components in the renderer. Same rule as the other frontend clients — typecheck + build + manual run. Tests live in `thefactory-ui/headless` and the backend.
