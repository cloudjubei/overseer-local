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

---

## B. Cross-repo feature work (in-flight)

Backed by the cross-repo plan at `/Users/cloud/.claude/plans/splendid-hopping-sunrise.md`. Four independent features; each pickable by a separate developer.

### B.1 GitHub OAuth (device flow) (Feature 1)

The Electron renderer can't reliably redirect (`file://` SPA); device flow only.

- Wire `<GitCredentialsForm hostCapabilities={{ canOpenBrowser: true, canRedirect: false }} />` (component lands in `thefactory-ui` §B.1; backend routes in `thefactory-backend` §E.1).
- Use `window.electron.shell.openExternal(verification_uri)` for opening the GitHub device entry — bridge via preload if not already exposed.

### B.2 Dictation via Electron Web Speech API (Feature 2 — best-effort)

The bundled Chromium may or may not expose `webkitSpeechRecognition`. Detect once at startup; if unsupported, the mic affordance never renders.

- New [src/renderer/src/speech/webSpeechEngine.ts](../src/renderer/src/speech/webSpeechEngine.ts) implementing `SpeechToTextEngine` (signature from `thefactory-ui/headless`). Continuous + interim results; `onresult` dispatches partial/final; `onerror` surfaces `e.error`.
- Wire via `<SpeechToTextEngineContext.Provider>` at the renderer root.
- Main-process permission handler in [src/main/index.ts](../src/main/index.ts) — `session.defaultSession.setPermissionRequestHandler` allowing `media` (microphone) for the renderer origin only.
- If Electron 30+ on macOS needs `app.commandLine.appendSwitch('enable-speech-dispatcher')` (verify at impl time), apply it before `app.whenReady()` and document in [ARCHITECTURE.md](./ARCHITECTURE.md).

### B.3 Git tools in chat (Feature 3)

No direct changes — the new previews + tool surface land in `thefactory-ui` (§B.3) and `thefactory-tools` (§B.1), and flow through the shared `renderToolPreview` dispatcher mounted in chat.

### B.4 CLI agents end-to-end (Feature 4)

Renderer consumes the same `thefactory-ui` web spine, so most surfaces land for free.

- **Settings → LLMs CLI section — DONE.** `CliConfigsProvider` mounts in the renderer `App.tsx` (inside `LLMConfigsProviderConnected`); `LLMSettings.tsx` renders a collapsible **CLI Agents** section with `<CliConfigForm />` **between the LLM list and Model Pricing**.
- **Chat dispatch** flows through the shared `createChatsContext` runner-aware fork (`sendChatCompletionWithTools`, `runner: 'cli'`) — no per-app code.
- Remaining per-app wiring: thread `ChatContext` into `<ModelChipConnected chatContext={…} />`; bind `usePendingToolGrants` into the chat connector for the `<ToolConfirmationModal />` "Allow permanently" path; `UsageModal` "By executor" renders once `getCost` maps `bySource`.
