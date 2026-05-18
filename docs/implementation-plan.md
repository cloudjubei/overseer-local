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

## B. Pending tasks — backend-only cutover

The work to land "desktop is a pure backend client." Order is dependency-driven.

### 1. Adapt `BackendConnectionPanel` for desktop's auth model

The wholesale lift of web's `src/ui/` brought [`BackendConnectionPanel`](../src/renderer/src/ui/components/settings/BackendConnectionPanel.tsx) into desktop's Developer settings. As shipped it reads `VITE_API_BASE_URL` (web's env var) and only supports replace/clear of the bearer token. Desktop needs:

- URL row reads from `useAuth().baseUrl` (safeStorage-backed), not `import.meta.env.VITE_API_BASE_URL`.
- "Change URL" input + "Test connection" button reusing [`LoginScreen`](../src/renderer/src/ui/screens/LoginScreen.tsx)'s `/health` flow.
- Reset-credential action clears both fields (mirrors `useAuth().clear`).

Long-term, this whole panel is a parity-bug candidate for promotion into `thefactory-ui/headless` per [thefactory-ui/docs/implementation-plan.md § B.5](../../thefactory-ui/docs/implementation-plan.md) — both clients want the same surface with platform-specific storage injected.

### 2. Main-process slimming

Once the renderer talks to the backend directly (over HTTP + WS, not IPC), the main process becomes a thin shell. Trim it accordingly:

- Window chrome: window controls, native menus, system tray icon, OS-level notifications, auto-updater.
- Native bridges that the renderer can't do itself: file picker, "open in Finder/Explorer," "open external URL," app-protocol handlers (deep links).
- That's it. No data services, no file watchers, no project / story / chat / git logic — those all live in `thefactory-backend` now.

### 3. Disconnected-state UX

When the network drops, behaviour mirrors mobile:

- Persistent banner at the top of the window when the WS is disconnected.
- Disable actions that need the WS (sending chat messages, creating stories) — show a tooltip on hover explaining why.
- Read-only views keep rendering their last-known data; they don't blank out.
- Automatic reconnect (the lifted `reconnecting-websocket` logic already handles this).
- No local cache. If the renderer has no data because the WS was never connected, show the empty / loading state, not a snapshot.

### 4. Build + packaging cleanup

- Remove `thefactory-tools` + `thefactory-db` from desktop's runtime deps (they move to `thefactory-backend`'s deps; desktop no longer imports them).
- Trim `electron-builder` / `electron-vite` config of the old main-process modules.
- Update the GitHub Actions release workflow so installer artifacts are pure-client (no bundled Node backend, no Postgres binary).
- Smoke-test signed installers on macOS + Windows + Linux against a live backend.

---

## C. Runtime model

- **Backend-only, always online, fresh start.** Desktop is a pure backend client — equivalent to web at the runtime level and to mobile at the deployment-target level.
- **Renderer talks to `thefactory-backend` over HTTP + WS**, exactly like web. Same generated SDK, same WS event stream.
- **Main process is window chrome + native bridges only** — no data services, no file watchers, no embedded Node runtime, no Postgres, no sidecar, no bundled backend. The user runs (or connects to) a `thefactory-backend` instance separately.
- **No backward compatibility, no data migration.** Existing `~/.factory/` trees are not auto-imported; this is treated as a fresh install.
- **No offline mode, no local cache, no sync layer.** Network drops show a disconnected banner; data screens stay on their last-known render. See §B.3.
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
