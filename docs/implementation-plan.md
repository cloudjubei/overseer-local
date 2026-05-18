# Implementation plan

For the architectural ground rules every change must follow, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the platform-adaptation rules see [PLATFORM_ADAPTATIONS.md](./PLATFORM_ADAPTATIONS.md) and [MULTI_PLATFORM_ARCHITECTURE.md](./MULTI_PLATFORM_ARCHITECTURE.md). For the UI conventions, see the canonical home at [thefactory-ui/docs/ARCHITECTURE.md § Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions). The reference implementation for the new direction is [thefactory-overseer-web](../../thefactory-overseer-web)'s renderer.

The earlier hybrid / dual-mode analysis is preserved verbatim at [docs/expansion/03-overseer-local-hybrid.md](./expansion/03-overseer-local-hybrid.md) — that document is **superseded**. The decision is below.

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

Things genuinely blocked on a third-party decision or external trigger, not on engineering work. All four cross-cutting questions that were here in the previous draft (sidecar vs external backend, Postgres bundling, data migration, offline scope) have been resolved — see §C for the decisions and §B for the work.

*(Currently empty — keep this section short and re-populate only when a real external blocker appears.)*

---

## B. Pending tasks — backend-only cutover

The work to land "desktop is a pure backend client." Order is dependency-driven.

### 1. Move the existing LOCAL implementation into `src/legacy/`

The current desktop ships everything via in-process managers under [src/logic/](../src/logic/) plus their main-process IPC handlers under [src/main/](../src/main/). This entire stack is going away as a runtime dependency — but the code stays in the repo for reference (algorithms, edge-case handling, data shapes, file-watcher patterns we may need to recall later).

Concretely:

- Create `src/legacy/` and move the current contents of `src/logic/` and `src/main/` (everything that's not pure Electron-window-chrome) under it. Preserve the original folder structure so a reader can navigate it like the old tree.
- Wire `src/legacy/` out of the build — no compilation, no imports from live code, no tests against it. A `src/legacy/README.md` explains what's there, when it was deprecated (2026-05), and why (backend-only cutover). Link to this plan.
- Delete the old IPC routes that pointed at the legacy managers. Renderer screens stay in place for now and will be re-pointed at the backend client in §B.3 — they'll be visibly broken in between, which is fine for an internal cutover branch.
- Add a note to [ARCHITECTURE.md](./ARCHITECTURE.md) explaining that `src/legacy/` exists, why it's there, and that **nothing in live code may import from it**. (Tracked separately in the parity-mandate todo list.)

Why first: every later step needs the slate clean. We don't want to refactor live code in two places (current LOCAL + new backend-client) while transitioning.

### 2. Backend client — HTTP + WS, lifted from web

Desktop talks to `thefactory-backend` over the same HTTP + WS surface the web app uses. Goal: one client, two consumers (web today, desktop tomorrow, mobile next).

- Generate the API client from `thefactory-backend/swagger/swagger.json` via `@hey-api/openapi-ts`. Mirror web's `openapi-ts.config.ts` exactly so the typed surface is identical.
- Lift `WsClient` and the auth shape from [thefactory-overseer-web/src/api/](../../thefactory-overseer-web/src/api/) into desktop's renderer. Same `reconnecting-websocket`-style logic; runs in the renderer (Chromium) without any Node shim.
- Auth: paste-and-store `apiKeyCredentialId` against backend's `LLMConfigEntry` — mirrors web 1:1. Credentials stored via Electron's `safeStorage`.
- First-run screen: backend URL input + paste-and-store credential + "test connection" button. No auto-discovery, no sidecar fallback.

### 3. Re-point the renderer at the backend client

The renderer's contexts under `src/renderer/core/contexts/` are already structurally identical to web's `src/core/contexts/` — that was the work of the BE-refactor branch. Now they swap their data source from "Electron IPC → legacy managers" to "backend HTTP + WS."

- For every context (`Projects`, `ProjectsGroups`, `Stories`, `Chats`, `Files`, `Git`, `Agents`, `Tests`, `Tools`, `LiveData`, `Costs`, `AppSettings`, …): replace its IPC calls with the generated SDK + `WsClient`.
- Where web has already lifted a context into `thefactory-ui/headless` (e.g. badge math, `chatsSeen` store, form state hooks), desktop imports from there directly instead of maintaining its own copy. Any context still duplicated between web and desktop is a parity bug — file a follow-up to promote it to `thefactory-ui/headless`.
- Delete the IPC keys, preload bridges, and main-process routers that backed the old data flow. Keep the IPC layer for genuinely Electron-only surfaces (window controls, native menus, system tray, OS notifications, native file pickers).

### 4. Main-process slimming

Once the renderer talks to the backend directly (over HTTP + WS, not IPC), the main process becomes a thin shell. Trim it accordingly:

- Window chrome: window controls, native menus, system tray icon, OS-level notifications, auto-updater.
- Native bridges that the renderer can't do itself: file picker, "open in Finder/Explorer," "open external URL," app-protocol handlers (deep links).
- That's it. No data services, no file watchers, no project / story / chat / git logic — those all live in `thefactory-backend` now.

### 5. Settings → Connection screen

Mirror web's connection settings, with the Electron-specific extras:

- Backend URL (input + "test connection").
- Credential (paste-and-store, `apiKeyCredentialId` resolving an `LLMConfigEntry` — same flow as web).
- Connection status indicator (online / connecting / disconnected).
- Reset-credential action.

This screen is also where the "you're disconnected" banner is configured (see §B.6).

### 6. Disconnected-state UX

Desktop is always-online by design (see §C). When the network drops, behaviour mirrors mobile:

- Persistent banner at the top of the window when the WS is disconnected.
- Disable actions that need the WS (sending chat messages, creating stories) — show a tooltip on hover explaining why.
- Read-only views keep rendering their last-known data; they don't blank out.
- Automatic reconnect (the lifted `reconnecting-websocket` logic already handles this).
- No local cache. If the renderer has no data because the WS was never connected, show the empty / loading state, not a snapshot.

### 7. Build + packaging cleanup

- Remove `thefactory-tools` + `thefactory-db` from desktop's runtime deps (they move to `thefactory-backend`'s deps; desktop no longer imports them).
- Trim `electron-builder` / `electron-vite` config of the old main-process modules.
- Update the GitHub Actions release workflow so installer artifacts are pure-client (no bundled Node backend, no Postgres binary).
- Smoke-test signed installers on macOS + Windows + Linux against a live backend.

---

## C. Direction: backend-only, always online, fresh start

The hybrid analysis ([expansion/03-overseer-local-hybrid.md](./expansion/03-overseer-local-hybrid.md)) explored dual-mode LOCAL + CONNECTED with mode switching, sidecar backends, Postgres bundling, and `~/.factory` migration. **All of that is dropped.** Desktop becomes a pure backend client, equivalent to web at the runtime level and to mobile at the deployment-target level.

Rationale:

- Maintaining two implementations of every manager forever doubles every bug surface, every test, every WS contract change. The cost is permanent.
- The CONNECTED path already exists in production for web. Reusing it for desktop catches API drift early and shrinks the desktop codebase substantially.
- Mobile is also backend-only (see [thefactory-overseer-mobile/docs/implementation-plan.md](../../thefactory-overseer-mobile/docs/implementation-plan.md)). Three clients sharing one transport contract is the parity story the [thefactory-ui](../../thefactory-ui) split is built around.
- Bundled-backend (sidecar), Postgres-in-the-app, data migration from existing `~/.factory/` trees — all turned out to be solving problems that **don't actually exist** under a fresh-start, always-online assumption. We're not carrying that complexity.

What that means concretely:

- The renderer talks to `thefactory-backend` over HTTP + WS, exactly like web.
- The main process is window chrome + native bridges only — no data services, no file watchers, no embedded Node runtime, no Postgres.
- No sidecar. No bundled backend. The user runs (or connects to) a `thefactory-backend` instance separately.
- No backward compatibility with the old LOCAL data layout. Existing `~/.factory/` trees are not migrated; users are expected to be on a fresh install or use one of the existing tools to push their data into the backend out-of-band.
- No offline mode, no local cache, no sync layer. Network drops show a disconnected banner; data screens stay on their last-known render. See §B.6.

What we keep:

- Electron-specific chrome: window controls, native menus, system tray, OS notifications, native file pickers, app-protocol handlers.
- Settings + theme state (UI-level, not data) — same `AppSettings` / `chatsSeen` localStorage model the web uses.
- Renderer-side IPC for the Electron-only surfaces above. Everything else is direct HTTP + WS.

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
