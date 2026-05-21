# Architecture Overview

`overseer-local` is the desktop Electron client for `thefactory-overseer`. It is a **pure backend client**: the renderer talks to [`thefactory-backend`](../../thefactory-backend) over HTTP + WS, mirroring [`thefactory-overseer-web`](../../thefactory-overseer-web) 1:1. The main process keeps only Electron-specific chrome (window, OS bridges) plus a `safeStorage`-backed auth bridge. There is no embedded backend, no Postgres, no sidecar, no file watchers.

The backend-only cutover landed in 2026-05. Outstanding follow-ups (all blocked on external triggers — signing certs, deferred features) live in [docs/implementation-plan.md](./implementation-plan.md); the build/sign/publish pipeline plan is in [docs/DEPLOYMENT.md](./DEPLOYMENT.md).

## Cross-client parity mandate

The three frontend clients — web, desktop, mobile — must mirror each other as closely as the host platform allows. Side-by-side they should read like the same app adapted to its surface, not three independent products.

**Web is first-class; desktop is big-screen, mobile is small-screen.** `thefactory-overseer-web` is the source of all new behaviour and the only client with _both_ a big-screen and a small-screen (narrow viewport — `useIsNarrowViewport`, below the `md` / 768px breakpoint) experience. **`overseer-local` (desktop) is big-screen only** and mirrors web's big-screen methodology; **`thefactory-overseer-mobile` (mobile) is small-screen only** and mirrors web's small-screen methodology. Desktop and mobile _stem from_ web — when something works a certain way on web it must be translated to the matching client: a big-screen web change → desktop, a small-screen web change → mobile. Desktop never receives small-screen features; mobile never receives big-screen features. There is no "desktop small-screen" — `isNarrow`-gated code is dormant here.

Concretely:

- **Shared spine is [thefactory-ui](../../thefactory-ui).** Tokens, headless hooks/stores, business logic, contexts, badge math, sanitisers, form state machines — all live there. Each client is mostly presentation glue around the shared spine.
- **File layout, screen names, navigation structure, context names, hook names match across clients.** Desktop's `src/renderer/ui/screens/StoriesScreen.tsx` and the equivalent web/mobile paths read the same.
- **Divergences are explicit and justified.** Electron-specific chrome (native menus, system tray, OS notifications) is accepted divergence; gratuitous divergence is not. When desktop needs to drift, the drift is documented at the call site with a comment pointing to the equivalent code in web/mobile.
- **Cross-client changes land together.** If a feature touches the chat surface, all three clients ship the change in the same release window. New shared code goes into `thefactory-ui` first; clients pull it in.

A new contributor opening web, desktop, and mobile side by side should be able to navigate by analogy. If they can't, something has drifted and the drift needs to be fixed.

## `src/legacy/`

The in-process LOCAL implementation (everything that was under `src/logic/`, the data-bearing parts of `src/main/`, and the original renderer's screens / services / hooks / navigation / components) is preserved verbatim under `src/legacy/` for reference. Folder structure is preserved so a reader can navigate it like the old tree; imports inside the legacy tree are likely dangling and that's intentional — the tree is excluded from build / typecheck / lint / tests.

Rules:

- **Nothing in live code may import from `src/legacy/`.** The build excludes it; lint / typecheck don't touch it; no tests run against it.
- The folder is kept purely for reference: algorithms, edge-case handling, data shapes, file-watcher patterns we may want to recall later when re-implementing equivalent surfaces in `thefactory-backend` or when investigating historical behaviour.
- `src/legacy/README.md` explains what's in there, when it was deprecated (2026-05), and why. It also links back to this section.
- Don't add new code to `src/legacy/`. If a piece of legacy code becomes load-bearing again, bring it back into live code with a clean home and delete the legacy copy.

If you find yourself wishing the legacy code was wired in, the answer is almost always to port the relevant slice into the backend instead — desktop is a pure backend client going forward.

## Cross-client parity

The renderer mirrors [`thefactory-overseer-web`](../../thefactory-overseer-web) module-for-module:

```
desktop (this repo)                       web
  src/renderer/src/api/                   src/api/
  src/renderer/src/core/{contexts,...}    src/core/{contexts,...}
  src/renderer/src/generated/backend/     src/generated/backend/
  src/renderer/src/services/              src/services/
  src/renderer/src/ui/                    src/ui/
  src/renderer/src/App.tsx                src/App.tsx
```

UI conventions live in [thefactory-ui/docs/ARCHITECTURE.md § Consumer-facing UI conventions](../../thefactory-ui/docs/ARCHITECTURE.md#consumer-facing-ui-conventions). Read that section first when touching anything under `src/renderer/src/ui/`. The behavioural parity rules (what counts as accepted vs gratuitous divergence) are in the **Cross-client parity mandate** section above.

## Process model

### Main process — `src/main/`

A thin Electron shell. Responsibilities:

- **Window chrome.** Creates the `BrowserWindow`, handles `ready-to-show`, the unresponsive-window dialog, and the `window-all-closed` / `activate` lifecycle.
- **External URL bridge.** `setWindowOpenHandler` routes `target="_blank"` / `shell.openExternal` requests out to the OS browser.
- **Auth IPC.** [`registerAuthIpc`](../src/main/registerAuthIpc.ts) exposes `auth:get|set|clear` against an [`authStore`](../src/main/authStore.ts) backed by Electron's `safeStorage`. The store keeps `{ baseUrl, token }` in `<userData>/auth.bin` (token encrypted; falls back to plaintext only when `safeStorage` is unavailable, which happens on Linux without keyring).

That's the whole surface. No data services, no file watchers, no embedded Node runtime, no project / story / chat / git logic — those all live in `thefactory-backend`.

### Preload — `src/preload/`

Two responsibilities, both minimal:

- Re-exposes `@electron-toolkit/preload`'s `electronAPI` to `window.electron`.
- Bridges the auth IPC handlers to `window.authService` (`get | set | clear`).

`src/preload/ipcHandlersKeys.ts` lists the three live IPC channels (`AUTH_GET | AUTH_SET | AUTH_CLEAR`).

### Renderer — `src/renderer/src/`

A React 19 SPA wrapped in `HashRouter` (HashRouter rather than BrowserRouter because the renderer loads from `file://` in production). Structure:

- `api/` — `WsClient` (reconnecting WebSocket against `/ws`), `bootstrap` (configures the generated `axios` client and installs a 401 interceptor), `helpers` / `errorMessage` / `types`. Lifted verbatim from web.
- `core/contexts/` — 20 React contexts (`Auth`, `Api`, `AppSettings`, `Projects`, `ProjectsGroups`, `Stories`, `Chats`, `Files`, `Git`, `GitCredentials`, `Agents`, `Tests`, `Tools`, `LLMConfigs`, `Costs`, `Entities`, `Ingestion`, `LiveDataProviders`, `Overseer`, `WebSearchKeys`). All mirror web except `AuthContext` (desktop reads/writes via the `auth:*` IPC instead of `localStorage`) and `ApiContext` (always-non-null `WsClient` constructed from `useAuth().baseUrl`).
- `core/{chats,files,hooks,notifications,shortcuts,types}/` — supporting headless utilities (file-tree / mention parsing, project-settings hook, badge math, keyboard shortcuts, settings types). `core/chats/chatKey.ts` is a thin re-export — see the `thefactory-tools` note below.
- `generated/backend/` — output of `@hey-api/openapi-ts` against `thefactory-backend/swagger/swagger.json`. Regenerate via `npm run generate:backend`.
- `services/authService.ts` — the renderer-side typed handle for the `window.authService` preload bridge.
- `ui/` — screens (`AgentsView`, `ChatView`, `FilesView`, `GitView`, `LoginScreen`, …) and components (`Sidebar`, `ScreenErrorBoundary`, settings panels, etc.). All mirror web except `LoginScreen.tsx` (paste-and-store flow against `safeStorage` instead of localStorage + env var) and `BackendConnectionPanel.tsx` (reads baseUrl from `AuthContext`; gains a "Replace URL" form and a "Reset all" button).

The auth gate lives in `App.tsx`'s `RequireAuth` wrapper: any route except `/login` redirects to `/login` when `useAuth().token` is null. Once authenticated, `AuthedRoot` redirects to the active project's `stories` tab (or `WelcomeView` if zero projects).

## Shared utilities from `thefactory-tools`

The renderer is a pure backend client and gets almost everything from the backend SDK + `thefactory-ui`. The **one** narrow exception: pure, node-free helpers whose output must byte-match the backend's own derivation are imported directly from `thefactory-tools/utils` rather than re-implemented.

Currently that's `getChatContextKey` / `getChatContext` (re-exported through `src/renderer/src/core/chats/chatKey.ts`). They derive the `chatKey` used for routing and cost-aggregate lookups. An earlier local re-implementation dropped a leading slash (`projects/X` vs the backend's `/projects/X`), so cost aggregates were stored under one key and queried under another — the UsageModal silently showed `$0`. Importing the upstream helper directly makes that class of drift impossible.

The exception is deliberately narrow — only pure functions whose result must match the backend exactly. Business logic, types, and everything else still come from the generated SDK / `thefactory-ui`. `thefactory-tools` is a `file:`-linked dependency; web and mobile follow the identical rule.

## Storage

- **Auth state** — `<userData>/auth.bin` (managed by `authStore`; token encrypted via `safeStorage`).
- **UI preferences** — same `localStorage` model the web uses (`AppSettings`, `chatsSeen`, sidebar collapse, etc.). Per-process, not synced across machines.
- **Everything else** — lives in `thefactory-backend`.

## Build + tooling

- **Bundler.** `electron-vite` produces three bundles (`main`, `preload`, `renderer`). Aliases (`@api`, `@core`, `@services`, `@generated`, `@ui`, `@renderer`) are defined identically in `tsconfig.web.json`, `electron.vite.config.ts`, and `vitest.config.ts`.
- **Typecheck.** `npm run typecheck` runs `tsc --noEmit` against `tsconfig.node.json` (main + preload + types) and `tsconfig.web.json` (renderer). Both `exclude` `src/legacy/**/*`.
- **Tests.** `npm run test` (vitest). Covers main-process `authStore`, the API layer (`WsClient`), and the lifted core/UI headless pieces (chat key, badge math, file utilities, shortcuts, hook tests). Per [memory `no_frontend_unit_tests`](../../../.claude/projects/-Users-cloud-Documents-Work-thefactory-tools/memory/feedback_no_frontend_unit_tests.md): UI components in `src/renderer/src/ui/` are not unit-tested; logical pieces under `core/` and `api/` are.
- **Packaging.** `electron-builder` produces signed installers (mac/win/linux). Outstanding cleanup items live in [docs/implementation-plan.md](./implementation-plan.md) (build + packaging cleanup task).

## Conceptual diagram

```
┌───────────────────────────────────────────────────────────────┐
│ Renderer (Chromium)                                           │
│   React 19 SPA · HashRouter · 20 context providers            │
│   ───────────                                                 │
│   • HTTP via generated SDK (axios)  ──┐                       │
│   • WS  via WsClient (reconnecting) ──┤                       │
│   • safeStorage IPC for auth        ──┘                       │
└──────┬──────────────────────────────┬─────────────────────────┘
       │ window.authService            │ http(s) + ws(s)
       ▼                               ▼
┌────────────────┐               ┌─────────────────────────────┐
│ Main (Node)    │               │ thefactory-backend          │
│   BrowserWin   │               │   Fastify + Postgres + …    │
│   external URL │               │   /projects /stories /chat … │
│   authStore    │               │   /ws (broadcast envelopes) │
│   (safeStorage)│               └─────────────────────────────┘
└────────────────┘
```

## Related docs

- File map and entry points: [docs/FILE_ORGANISATION.md](./FILE_ORGANISATION.md)
- Engineering patterns: [docs/PATTERNS.md](./PATTERNS.md)
- Shared UI package: [thefactory-ui/docs/ARCHITECTURE.md](../../thefactory-ui/docs/ARCHITECTURE.md)
- Web client (parity reference): [thefactory-overseer-web/docs/ARCHITECTURE.md](../../thefactory-overseer-web/docs/ARCHITECTURE.md)
