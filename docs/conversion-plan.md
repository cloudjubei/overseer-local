# Conversion plan: adopt `thefactory-ui` in `overseer-local`

## Why this plan exists

`overseer-local` is the visual reference for every `thefactory-*` consumer. The previous strategy — recreating `overseer-local`'s look in `thefactory-overseer-web` from outside-in summaries — didn't actually produce parity. The web app still doesn't look like the desktop app.

This plan reverses direction. We migrate `overseer-local` itself to consume the new [`thefactory-ui`](../../thefactory-ui/) package, screen by screen. Each migration step is a visible change in the desktop app, so any visual or behavioral discrepancy between the local component and its `thefactory-ui` replacement surfaces immediately — and gets fixed in `thefactory-ui` (the right place) before the change propagates.

When this conversion finishes, `thefactory-overseer-web` rebuilds against a corrected `thefactory-ui` and inherits the parity automatically.

## How to drive this plan

- **One step per PR.** Land it, exercise the affected screen in the desktop app, sign off, move on.
- When a discrepancy surfaces:
  - **(a)** missing/wrong prop on `thefactory-ui` → fix in [thefactory-ui](../../thefactory-ui/), nothing to install — the `file:` link picks up the next `npm run build`.
  - **(b)** wiring code in `overseer-local` doesn't match the package's API → fix here.
  - **(c)** deliberate design change accepted by the user → record at the bottom of this doc under "Accepted divergences".
- **No bulk-swaps.** Local components under [src/renderer/src/components/ui/](../src/renderer/src/components/ui/) stay until their consumers migrate. After each step, only the migrated screen uses `thefactory-ui` for those primitives; everything else still uses the local copy.
- **No new features during conversion.** Every step is an in-kind swap.

---

## A. Open questions

_(empty — record any blockers here as they come up)_

---

## B. Pending steps

### Setup (one-time, lands before any screen migration)

#### Step 0 — Link `thefactory-ui` as a file: dependency

- **Edit:** [package.json](../package.json). Add `"thefactory-ui": "file:../thefactory-ui"` under `dependencies`. Mirror the `"thefactory-tools": "file:../thefactory-tools"` pattern already there.
- **Run:** `npm install`. Verify `node_modules/thefactory-ui/dist/` is populated.
- **Sanity check:** in any renderer file, write `import { Button } from 'thefactory-ui/web'` and let TypeScript resolve it. Don't render anything yet.
- **Risk:** zero. Nothing in the app consumes the new package until Step 2.

#### Step 1 — Confirm CSS overlap is safe

- **Read:** [src/renderer/src/index.css](../src/renderer/src/index.css) (the current bundle) and `thefactory-ui/dist/styles/index.css` (the published bundle). Both ship the same TS-derived design tokens.
- **Decide:** until the migration drains, **keep overseer-local's existing CSS imports**. The published package is a superset of the local CSS, but until every screen consumes the package we shouldn't replace the local bundle — that's a bulk change that fights the screen-by-screen rule.
- **Do nothing in code yet.** This step exists so the user can confirm the intent before Step 2.
- **Risk:** zero (no code change).

#### Step 2 — Add the package CSS bundle alongside the local one (parallel)

- **Edit:** [src/renderer/src/index.css](../src/renderer/src/index.css). Append `@import 'thefactory-ui/web/styles';` **at the end**, after every local `@import`. Order matters — anything the local bundle defines wins; the package fills in only what's missing.
- **Verify:** `npm run build:renderer` (or whatever the renderer build command is); the renderer's main bundle should grow slightly (the package's class names get included where Tailwind finds them used) but no visual regression should appear since no consumer has migrated yet.
- **Risk:** if a CSS variable from the package overrides one from the local bundle in an unintended way, isolate by moving the `@import` to a `@layer` declaration — but most likely it just works because the underlying tokens are identical.

---

### Screen-by-screen migration

Order is foundation → small screens → big screens. Each step lists files to change, the swap targets, what to compare against the un-migrated state, and known risks.

#### Step 3 — App shell (sidebar + main view)

- **Files:** [navigation/main/MainView.tsx](../src/renderer/src/navigation/main/MainView.tsx), [navigation/sidebar/SidebarView.tsx](../src/renderer/src/navigation/sidebar/SidebarView.tsx), and the three `*NavItem.tsx` files alongside it.
- **Swap:** `NotificationBadge`, `DotBadge`, icons (`IconChevron`, `IconWorkspace`, the tab icons). Import these from `thefactory-ui/web` and `thefactory-ui/web/icons` instead of `../components/ui/*` and `../components/ui/icons/*`.
- **Compare:** sidebar collapse/expand still animates, notification dots render at the right colors, drag-reorder of projects within their group still works, keyboard nav (Arrow keys / Home / End) still hops between rows.
- **Risk:** local icon names may not match thefactory-ui's verbatim — confirm each icon's package name before the swap (run `ls node_modules/thefactory-ui/dist/web/icons/`).

#### Step 4 — Auxiliary screens (Welcome, Loading, Login, Onboarding)

- **Files:** [LoadingScreen.tsx](../src/renderer/src/screens/LoadingScreen.tsx), [OnboardingView.tsx](../src/renderer/src/screens/OnboardingView.tsx), and any login screen still in use.
- **Swap:** `Button`, `Spinner`, `Alert`, `Field`, `Input`.
- **Compare:** loading text, spinner animation speed, error banner styling, button hover/pressed states match.
- **Risk:** low — these screens are simple. Good warm-up before the heavy screens.

#### Step 5 — Stories (list, board, modals)

- **Files:** [screens/StoriesView.tsx](../src/renderer/src/screens/StoriesView.tsx), [screens/stories/StoriesListView.tsx](../src/renderer/src/screens/stories/StoriesListView.tsx), [screens/stories/BoardView.tsx](../src/renderer/src/screens/stories/BoardView.tsx), [screens/stories/StoryDetailsView.tsx](../src/renderer/src/screens/stories/StoryDetailsView.tsx), and the story / feature create / edit / delete modals under `screens/stories/`.
- **Swap:** `SegmentedControl` (list/board toggle), `Button`, `Modal`, `Input`, `Select`, `Switch`, `StatusChip`, `Tooltip`, `Field`, `Textarea`.
- **Compare:** the list rows look identical (status icon, `done/total` chip, title, description, blockers, agent-run bullets); the board grid spaces columns the same; drag-reorder works; status pickers commit; the modals open / submit / close as before.
- **Risk:** lots of primitives swapped at once. Split into **5a — list**, **5b — board**, **5c — modals** if any single PR gets thick.

#### Step 6 — Chat

- **Files:** [screens/ChatView.tsx](../src/renderer/src/screens/ChatView.tsx), [components/chat/ChatSidebar.tsx](../src/renderer/src/components/chat/ChatSidebar.tsx), [components/chat/ChatsNavigationSidebar.tsx](../src/renderer/src/components/chat/ChatsNavigationSidebar.tsx), [components/chat/ChatInput.tsx](../src/renderer/src/components/chat/ChatInput.tsx), [components/chat/MessageList.tsx](../src/renderer/src/components/chat/MessageList.tsx), the `ToolCall*` family.
- **Swap:** `FileMentionsTextarea`, `Button`, `Tooltip`, `Markdown`, `TypewriterText`, the diff / code primitives the tool-call renderers use, `IconAttach` / `IconSend`.
- **Compare:** the composer auto-sizes to ~250 px max; `@` triggers file autocomplete; the attach button still uploads through the Electron IPC path; the send button enables only when there's content; aborting a turn shows the stop icon mid-composer; messages render markdown + code + tool-call cards identically.
- **Risk:** `overseer-local`'s ChatInput is much richer than `thefactory-ui`'s `FileMentionsTextarea` (attachments, suggested-actions row, info popover, abort confirm dialog). One of two outcomes:
  - The local `ChatInput.tsx` stays as a thin wrapper that owns the layout + extras and embeds `FileMentionsTextarea` for the actual editing surface. **Likely the right call.**
  - Lift the missing affordances into `thefactory-ui`'s `FileMentionsTextarea` — but only if they make sense for `thefactory-overseer-web` too. Most do.

#### Step 7 — Files

- **Files:** [screens/FilesView.tsx](../src/renderer/src/screens/FilesView.tsx) plus any file-viewer / editor / search component under `screens/` or `components/`.
- **Swap:** `Input` (the search box), `Button`, `Spinner`, `Alert`, the icons used by the file tree, `Markdown` (for `.md` preview if the viewer uses it).
- **Compare:** tree expand/collapse, file-content rendering, search filtering, upload + delete actions.
- **Risk:** `overseer-local`'s `MarkdownEditor` (the editable variant) has no `thefactory-ui` equivalent yet — keep it local for now. Note this in "Accepted divergences" so it's not forgotten.

#### Step 8 — Git

- **Files:** [screens/GitView.tsx](../src/renderer/src/screens/GitView.tsx) and everything under [screens/git/](../src/renderer/src/screens/git/).
- **Swap:** `Button`, `ResizeHandle`, `Tooltip`, `DiffViewer` (+ its parsing helpers if used directly), the icons that drive the right-side action rail.
- **Compare:** the 3-panel layout (sidebar / center stacked / action rail) doesn't reflow; branch selection drives the center pane; commit / push / pull / merge / checkout / create-branch modals open and submit; the diff renders correctly on a real commit.
- **Risk:** `DiffViewer` is the most complex compound in `thefactory-ui`. Test against a commit that has rename + content edits + binary additions, not just a one-line text change.

#### Step 9 — Tests

- **Files:** [screens/TestsView.tsx](../src/renderer/src/screens/TestsView.tsx) plus any helper components.
- **Swap:** `SegmentedControl` (tabs), `Button`, `Surface`, `Input` (e2e config-path field), `Alert`.
- **Compare:** tab switching is instant, abort works, per-file result rows show stack frames the same way, coverage report colors match.
- **Risk:** low — Tests is a tight screen.

#### Step 10 — Tools

- **Files:** [screens/ToolsView.tsx](../src/renderer/src/screens/ToolsView.tsx).
- **Swap:** `Input` (search), `Button`, `Surface`, `Select`, `Switch`, `Field`, `Textarea`.
- **Compare:** grouped tool list, per-parameter schema fields, execute + result rendering.
- **Risk:** low.

#### Step 11 — Settings

- **Files:** [screens/SettingsView.tsx](../src/renderer/src/screens/SettingsView.tsx) plus every subfolder under [screens/settings/](../src/renderer/src/screens/settings/) (visual / llms / notifications / github / websearch / database / developer).
- **Swap:** `CollapsibleSidebar` (the settings nav), `Field`, `Input`, `Select`, `Switch`, `Button`, `Surface`, color-picker / toggles in the visual panel.
- **Compare:** each category renders, saves, and survives a reload; the sidebar's collapsed/expanded state persists in `localStorage` under the same key as today.
- **Risk:** there are seven category sub-pages, each independent — split into per-category PRs if any single one gets thick.

#### Step 12 — Timeline

- **Files:** [screens/ProjectTimelineView.tsx](../src/renderer/src/screens/ProjectTimelineView.tsx) and everything under [screens/projectTimeline/](../src/renderer/src/screens/projectTimeline/).
- **Swap:** `SegmentedControl` (Day / Week / Month), `Switch` (All projects toggle), `Button`, `Tooltip`. The `TimelineHoverCard` is bespoke — leave it; just swap the primitives it uses inside.
- **Compare:** the Gantt grid renders the same number of columns at each zoom, the year strip stays in sync with horizontal scroll, hover surfaces the right card, label create/edit through `dbService` still works (this path doesn't touch `thefactory-ui` and stays local).
- **Risk:** the timeline is the largest single screen (~1000 lines). Don't try to refactor it during the migration; just swap primitives.

---

### Cleanup

#### Step 13 — Delete redundant local primitives

- After Steps 3–12 have all landed, run `grep -RnE "from '\.\./components/ui/(Button|Modal|...)" src/renderer/src/` for each migrated component. Anything with zero hits is dead.
- Delete the dead files under [src/renderer/src/components/ui/](../src/renderer/src/components/ui/) in one focused PR. Expect most of that directory to disappear.
- Keep anything that's truly Electron-specific (native menus, window-control wrappers, etc.).

#### Step 14 — Retire the local design-token CSS

- Once everything renders through `thefactory-ui`'s token bundle, delete [src/renderer/src/styles/design-tokens.css](../src/renderer/src/styles/design-tokens.css) and the foundation / primitive / component CSS files under [src/renderer/src/styles/](../src/renderer/src/styles/) that the package now owns.
- Update [src/renderer/src/index.css](../src/renderer/src/index.css) to drop those imports — only the single `@import 'thefactory-ui/web/styles';` line remains (plus any app-only screen CSS that genuinely doesn't belong in the shared package).
- This is also the step where the `tailwind.config.js` `colors.brand`/etc. mapping gets re-checked — if the package's `@source` directive already drives Tailwind utilities (it should), the local mapping can be slimmed.

#### Step 15 — Trigger the downstream rebuild

- Notify the `thefactory-overseer-web` maintainer (or yourself): with `thefactory-ui` polished by this conversion, the web app rebuilds against the corrected package and parity follows.
- This is also the cue to publish `thefactory-ui` to npm so the `file:` links in both consumers can swap to a real version range.

---

## C. Accepted divergences

Record here, with date, anything the user explicitly accepts as a deliberate difference between the old local component and the new `thefactory-ui` one.

_(empty)_

---

## Non-goals

- Adding new features to the desktop app while migrating. Each step is an in-kind swap.
- Porting Electron / IPC chrome into `thefactory-ui`. Window controls, native menus, file-system bridges, `dbService` — all stay in `overseer-local`.
- Touching `thefactory-overseer-web` until this conversion has drained. The web app rebuilds from the package automatically on the next install.
- Refactoring screens during the migration. If a screen feels wrong, file a follow-up; don't fold it into a primitive-swap PR.
