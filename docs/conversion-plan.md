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

- **Why does the package's `tokens.css` `:root` block only partially merge into the consumer's CSS?** Surfaced during Step 8b verification: the DiffViewer toolbar referenced `bg-(--surface-muted)` but the variable was missing from the final compiled CSS bundle even though the package's `tokens.css` declares it. Patched for now by adding `--surface-muted` (and dark-mode value) to `src/renderer/src/styles/design-tokens.css`. Audited the package's runtime references — only `--surface-muted` was both used and missing; `--accent-secondary` is referenced from a JS class string but isn't declared in the package's tokens either, so it's a pre-existing dangling reference. **Open work:** trace whether Tailwind v4's `@import 'tailwindcss'` (which sits between the local `@import './styles/design-tokens.css'` and `@import 'thefactory-ui/web/styles'` in [index.css](../src/renderer/src/index.css)) is silently dropping the package's `:root` declarations that don't overlap with the local block's keys. Resolving this lets us delete the local `design-tokens.css` outright in Step 14 instead of forwarding every package token by hand.

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

#### Step 5 — Stories

Split into five checkpoints so each visible chunk can be exercised in the desktop app before moving on.

##### Step 5a — List view + leaf components _(shipped 2026-05-11)_

- **Files:** [screens/stories/StoriesListView.tsx](../src/renderer/src/screens/stories/StoriesListView.tsx), [components/stories/StoryCard.tsx](../src/renderer/src/components/stories/StoryCard.tsx), [components/stories/FeatureCard.tsx](../src/renderer/src/components/stories/FeatureCard.tsx), [components/stories/RunAgentButton.tsx](../src/renderer/src/components/stories/RunAgentButton.tsx), [components/stories/DependencyBullet.tsx](../src/renderer/src/components/stories/DependencyBullet.tsx), [components/stories/WarningChip.tsx](../src/renderer/src/components/stories/WarningChip.tsx), [components/stories/ExclamationChip.tsx](../src/renderer/src/components/stories/ExclamationChip.tsx), [components/stories/ContextFileChip.tsx](../src/renderer/src/components/stories/ContextFileChip.tsx).
- **Swap:** `SegmentedControl`, `Skeleton`, `SkeletonText`, `Markdown`, `Tooltip`, `Button`, `FileDisplay`, list-view icons (`IconBoard`, `IconCalculator`, `IconEdit`, `IconList`, `IconPlus`, `IconPlay`, `IconXCircle`, `IconExclamation`).

##### Step 5b — Board view _(shipped 2026-05-11)_

- **Files:** [screens/stories/BoardView.tsx](../src/renderer/src/screens/stories/BoardView.tsx).
- **Swap:** `IconChevronLeft`, `IconChevronRight`.

##### Step 5c — Modals + details view + forms _(shipped 2026-05-11)_

- **Files:** [screens/stories/StoryCreateView.tsx](../src/renderer/src/screens/stories/StoryCreateView.tsx), [screens/stories/StoryEditView.tsx](../src/renderer/src/screens/stories/StoryEditView.tsx), [screens/stories/StoryDetailsView.tsx](../src/renderer/src/screens/stories/StoryDetailsView.tsx), [screens/stories/FeatureCreateView.tsx](../src/renderer/src/screens/stories/FeatureCreateView.tsx), [screens/stories/FeatureEditView.tsx](../src/renderer/src/screens/stories/FeatureEditView.tsx), [components/stories/FeatureForm.tsx](../src/renderer/src/components/stories/FeatureForm.tsx).
- **Swap:** `Modal`, `AlertDialog → ConfirmDialog` (prop renames: `confirmText → confirmLabel`, `cancelText → cancelLabel`, `destructiveConfirm → destructive`, `disableOutsideClose → closeOnOverlayClick={false}`), `Button`, `IconDelete`, `IconPlus`, plus StoryDetailsView icons (`IconCalculator`, `IconChevron`, `IconEdit`, `IconPlus`).
- **Upstream:** added `closeOnOverlayClick` and `closeOnEsc` props to `thefactory-ui`'s `ConfirmDialog`.

##### Step 5d — Connected RichText wrapper + swap RichText consumers _(shipped 2026-05-12)_

- **Implementation:** rewrote the existing [components/ui/RichText.tsx](../src/renderer/src/components/ui/RichText.tsx) as a thin wrapper around the package primitive — kept the same module path / named export so no call-site changes were needed in [StoriesListView.tsx](../src/renderer/src/screens/stories/StoriesListView.tsx) or [StoryDetailsView.tsx](../src/renderer/src/screens/stories/StoryDetailsView.tsx). The wrapper supplies `onResolveFile` (pulling from local `useFiles()` with basename fallback) and `renderDependency` (rendering `<DependencyBullet>`).
- **Testing note:** RichText only shows visible differences when text contains `@file/path.ext` mentions or `#story-id`/`#feature-id` references. Empty / plain-prose stories render identically to before. To exercise the new code paths visually, edit a story description to include something like `See @README.md, depends on #<some-story-id>` and confirm both render as chips/bullets.

##### Step 5e — `ToastProvider` + `useToast` lock-step swap _(shipped 2026-05-12)_

- **Implementation:** swapped [App.tsx](../src/renderer/src/App.tsx)'s `ToastProvider` import to `thefactory-ui/web`. All seven `useToast` call sites (4 stories views + `SettingsLLMConfigModal` + `MergeConflictResolver` + `ChatSidebar`) updated in lock-step. The `toast({...})` call shape is identical, so the only consumer-visible change is the styling of rendered toasts. Local [components/ui/Toast.tsx](../src/renderer/src/components/ui/Toast.tsx) is now orphaned — gets deleted in Step 13 cleanup.

#### Step 6 — Chat

Split into three checkpoints because two of the heavier primitives (`FileMentionsTextarea`, `FileSelector`) have decoupled-resolver gaps that need wrappers, and the existing local `ChatInput.tsx` is much richer than the package version.

##### Step 6a — `FileSelector` wrapper + swap consumers _(shipped 2026-05-12)_

- **Implementation:** rewrote [components/ui/FileSelector.tsx](../src/renderer/src/components/ui/FileSelector.tsx) as a thin wrapper around the package primitive — pulls files from local `useFiles()` and renames `selected → initialSelected`. Same module path / named export, no call-site change needed in [FeatureForm.tsx](../src/renderer/src/components/stories/FeatureForm.tsx). No Chat-side `FileSelector` consumer found (the chat composer uses `FileMentionsTextarea` for `@`-mentions but not a multi-pick selector).
- **Upstream fix during Step 6a:** the package's `FileSelector` checkmark used `bg-brand-600`/`border-brand-600` named utilities, which aren't generated downstream when the consumer's Tailwind setup doesn't fully register the package's `@theme inline { --color-brand-* }` block. Switched to `bg-(--color-brand-600)`/`border-(--color-brand-600)` (Tailwind v4 arbitrary-value syntax) which reference the CSS variable directly. See "C. Accepted divergences" for the package-wide rule.

##### Step 6b — `FileMentionsTextarea` upstream extension + local wrapper _(shipped 2026-05-12)_

- **Decision:** lifted `#`-references upstream into the package primitive (option A). Rationale: the package already had caret-detection + dropdown machinery for `@`-mentions; parallelising for `#` was small (~70 LoC) compared to duplicating ~220 lines of autocomplete state in every consumer. `thefactory-overseer-web` gets the feature for free when it migrates.
- **Upstream additions** ([thefactory-ui/src/web/compound/files/](../../thefactory-ui/src/web/compound/files/)):
  - New `reference.ts` with `parseReference`, `applyReference`, `ReferenceParse`, `ReferenceSuggestion` — parallel to the existing `mention.ts` `@`-API.
  - `FileMentionsTextarea` now accepts `onSearchReferences?: (token) => ReferenceSuggestion[]` and renders a second dropdown when the caret is in a `#token`. The two dropdowns are mutually exclusive (caret can only be in one token).
  - Added `onAcceptFileMention?` and `onAcceptReference?` callbacks that fire AFTER the user confirms a suggestion (Enter / Tab / click) — used by consumers for side effects like pushing the file path into context-files or the ref into blockers.
- **Local wrapper** ([components/ui/FileMentionsTextarea.tsx](../src/renderer/src/components/ui/FileMentionsTextarea.tsx)): rewritten as a thin wrapper that wires the package primitive. The wrapper translates the legacy prop names (`onFileMentionSelected`/`onReferenceSelected` → `onAcceptFileMention`/`onAcceptReference`, `inputRef` → `ref`) and pulls files from `useFiles()` + references from `useStories()` + display-index helpers. `disableAutocomplete` is implemented by passing `undefined` callbacks. References use the human-friendly display form (`#3.2`), preserving how stories/features have been referenced in this app.
- **Now orphaned, deleted in Step 13:** [hooks/useFilesAutocomplete.ts](../src/renderer/src/hooks/useFilesAutocomplete.ts), [hooks/useReferencesAutocomplete.ts](../src/renderer/src/hooks/useReferencesAutocomplete.ts).
- **Consumers (unchanged):** [components/chat/ChatInput.tsx](../src/renderer/src/components/chat/ChatInput.tsx), [components/stories/FeatureForm.tsx](../src/renderer/src/components/stories/FeatureForm.tsx). Both keep their existing `import FileMentionsTextarea from '@renderer/components/ui/FileMentionsTextarea'`.

##### Step 6c — The rest of Chat (layout + everything else) _(shipped 2026-05-12, regressions patched same day)_

- **Implementation:** bulk-swapped imports across the chat surface — ~20 files under [components/chat/](../src/renderer/src/components/chat/), [components/chat/sidebar/](../src/renderer/src/components/chat/sidebar/), [components/chat/ToolCall/](../src/renderer/src/components/chat/ToolCall/), plus [screens/ChatView.tsx](../src/renderer/src/screens/ChatView.tsx). Swapped `Button`, `Modal`, `Tooltip`, `Switch`, `Spinner`, `SpinnerWithDot`, `DotBadge`, `SegmentedControl`, `Code`, `Markdown`, `TypewriterText`, `FileDisplay`, `ResizeHandle`, `PathDisplay`, plus icons (`IconAttach`, `IconSend`, `IconChat`, `IconChevron`, `IconChevronRight`, `IconCalculator`, `IconCheckmarkCircle`, `IconHourglass`, `IconError`, `IconPlus`, `IconRefresh`, `IconSettings`, `IconToolbox`, `IconDelete`).
- **Kept local:** [ChatInput.tsx](../src/renderer/src/components/chat/ChatInput.tsx) (custom wrapper around package `FileMentionsTextarea` — owns attachment list, suggested-actions row, info popover, abort confirm); `RichText` and `FileMentionsTextarea` wrappers (already wired in Steps 5d / 6b); `ContextInfoButton` and `ErrorBubble` (project-specific composites); `IconScroll`, `IconRefreshChat`, `IconCode`, `IconNotAllowed`, `IconStop` (icons not in package — flagged for upstream when convenient).
- **Prop drift handled in this step:**
  - 2× `Modal contentClassName` props dropped ([UsageModal](../src/renderer/src/components/chat/UsageModal.tsx), [ChatDynamicContextModal](../src/renderer/src/components/chat/ChatDynamicContextModal.tsx)) — package Modal's default body area is functionally equivalent.
  - 3× `FileDisplay` call sites stopped constructing `{ ctime }` ([AttachmentList](../src/renderer/src/components/chat/AttachmentList.tsx), [FilesSuggestionsMenu](../src/renderer/src/components/chat/FilesSuggestionsMenu.tsx), [MessageRow](../src/renderer/src/components/chat/MessageRow.tsx)) — `UikitFileMeta` has no `ctime`.
  - 1× `TypewriterText renderer="markdown"` dropped ([MessageRow](../src/renderer/src/components/chat/MessageRow.tsx)) — Markdown is the package's default `render`.
- **Upstream:** added `Spinner.label?: string` prop (4 chat sites use it for "Loading preview…" style captions).
- **Same-day regression fixes (2026-05-12), all upstream:**
  - **Chat composer**: my local `FileMentionsTextarea` wrapper sandwiched the package primitive inside an extra `<div style={overflowY:auto, maxHeight:250}>`. That caused a double scrollbar AND clipped the absolutely-positioned mention dropdown. Removed the wrapping div; added `style?: CSSProperties` and `id?: string` props to the package primitive so the consumer's inline styles + `htmlFor` ids reach the textarea directly. Also stopped the package's `FileMentionsTextarea` from rendering the shared `<Textarea>` primitive (which added `rounded-md border bg-surface-raised`); now uses a raw `<textarea>` with minimal `w-full bg-transparent outline-none resize-none` defaults so consumer cards control the chrome.
  - **Markdown rendering**: first attempt was a CSS-only bump in `.markdown-content` (heading weights, paragraph/list margins). User reported it still didn't match, especially in the no-messages system prompt and long assistant replies. Root cause: `.markdown-content X` selectors outrank a single Tailwind utility class, so any wrapper-side Tailwind utility couldn't push styling back to parity. Fix: ported the legacy local `components` map (h1/h2 `font-bold` + bottom border, h3+ `font-semibold`, `my-1 leading-relaxed` paragraphs, `ml-6 mb-4 space-y-1` lists, `bg-(--surface-muted) p-4 my-4` fenced blocks, etc.) verbatim into the package's `<Markdown>` JSX. The CSS file is now strictly container-level (overflow-wrap, inline-code break behaviour, GFM checkbox margin) — no per-tag rules so it can't fight the component map.
  - **`Modal contentClassName` restored** (UsageModal, ChatDynamicContextModal, **and the System Prompt modal** opened by the 2nd button in the chat sidebar header — same regression class, missed in the first pass): the prop was wholesale-dropped in Step 5c on the assumption the default `p-4 overflow-y-auto` body wrapper covered every case. These three modals all need full-bleed content (their first child supplies the padded gray background). Reintroduced `contentClassName?: string` on the package `Modal`; all three call sites now pass `contentClassName="!p-0"`. Default behaviour unchanged for the four `StoryCreateView` / `StoryEditView` / `FeatureCreateView` / `FeatureEditView` modals from Step 5c — they were genuinely fine without the prop.
  - **Icons lifted**: `IconBack`, `IconCode`, `IconCollection`, `IconNotAllowed`, `IconRefreshChat`, `IconScroll`, `IconStop` are now in `thefactory-ui/web/icons`. The mixed local-import workarounds in StoryDetailsView, GroupNavItem, ChatSidebarHeader, StatusIcon, ToolCallCard are gone — those files now import everything from the package barrel.

#### Step 7 — Files _(shipped 2026-05-12, with polish round same day)_

- **Initial pass.** The actual Files surface in `overseer-local` is much smaller than the original plan suggested — no search box, no `Alert`/`Button`/`Spinner` in [FilesView.tsx](../src/renderer/src/screens/FilesView.tsx); only icons and a markdown previewer. Two files changed:
  - [FilesView.tsx](../src/renderer/src/screens/FilesView.tsx): swapped `IconChevron`, `IconFolder`, `IconFolderOpen` to `thefactory-ui/web/icons`.
  - [components/files/MarkdownEditor.tsx](../src/renderer/src/components/files/MarkdownEditor.tsx): swapped `Markdown` to `thefactory-ui/web`.
- **Polish round.** Surfaced four UX improvements that overseer-local never had but should — applied to both `overseer-local` and `thefactory-overseer-web`:
  1. **Per-language file icons in the tree.** The package's `FileDisplay` had a per-extension icon switch; the file tree was rendering a generic `IconDocument` for every row. Extracted the routing into a new `<FileTypeIcon>` exported from `thefactory-ui/web` (with `iconForExt` + `extFromTypeOrName` helpers). Added language coverage beyond the original `ts/js/css/html/json/md`: `py`, `rs`, `go`, `java`, `kt`, `rb`, `php`, `swift`, `c/cpp/h`, `sh/bash/zsh/fish`, `yml/yaml`, `xml`, `toml`, `sql`, `jsx`. Both apps' file trees now render coloured language badges.
  2. **`MarkdownEditor` lifted upstream.** New `<MarkdownEditor>` compound in `thefactory-ui` — two-pane shell (textarea | preview) with a header that has per-pane "Edit view" / "Preview view" labels, a `SegmentedControl` for pane visibility (edit-only / both / preview-only) with VS-Code-style split-square icons, and an icon save button (disabled until `isDirty`). Component is stateless w.r.t. file I/O — accepts `{ value, onChange, onSave, isDirty, loading, allowHtml, title }`. The local [components/files/MarkdownEditor.tsx](../src/renderer/src/components/files/MarkdownEditor.tsx) is now a thin wrapper that owns the file-load / write-back via `FilesContext` + the `useUnsavedChanges` navigation guard. Mirrored in `thefactory-overseer-web`'s [FilePane.tsx](../../thefactory-overseer-web/src/ui/components/files/FilePane.tsx) — `.md`/`.mdx` files now render the same shell; non-markdown files keep the existing edit-toggle textarea path.
  3. **Collapsible files-list pane** in both apps' FilesView. Toggle persisted in `localStorage` under `files-pane-collapsed`. Collapsed state shrinks the aside to 40 px with just the chevron / menu toggle; expanded restores the search / tree. Implemented inline (no new package primitive — only 2 consumers and the existing `CollapsibleSidebar` is shaped for flat-list nav, not recursive file trees).
- **Upstream:**
  - Ported `IconDocument` into `thefactory-ui/src/web/icons/`.
  - Added `allowHtml?: boolean` prop to `<Markdown>` — gates `rehype-raw` + `rehype-sanitize` (with a permissive schema for `className`, `target`, `rel`). Added `rehype-raw` + `rehype-sanitize` to `thefactory-ui` dependencies.
  - Added `<FileTypeIcon>` compound + `iconForExt` / `extFromTypeOrName` helpers (extracted from `FileDisplay`).
  - Added `<MarkdownEditor>` compound.
  - Added `IconSave` to the icon barrel.
  - Added `hideLabels?: boolean` prop to `<SegmentedControl>` (labels become `sr-only` + `title` hover preserved). Used by `<MarkdownEditor>`'s pane-visibility switch for the icon-only look.
  - `<MarkdownEditor>` save button now uses the package `<Button>` primitive (`variant="secondary"`, `size="icon"`) instead of a raw `<button>`, so it matches the standard surface-with-border button style used elsewhere.

#### Step 8 — Git

The Git surface is ~5000 LoC across 26 files. Every primitive it touches (`Button`, `Modal`, `Tooltip`, `Spinner`, `SegmentedControl`, `ResizeHandle`, `PathDisplay`, `DiffViewer`) and every icon it uses (`IconArchive`, `IconArrowDown`, `IconArrowUp`, `IconBranch`, `IconChevron`, `IconChevronDown`, `IconCommit`, `IconDelete`, `IconDoubleUp`, `IconFastMerge`, `IconFolder`, `IconFolderOpen`, `IconGlobe`, `IconPullRequest`, `IconRefresh`, `IconRevert`) is already in `thefactory-ui` — so this step is a primitive-import rewrite, not a feature lift. Split into four checkpoints so the desktop app can be exercised after each chunk.

##### Step 8a — Common + sidebar + action rail + commit graph _(shipped 2026-05-12)_

- **Implementation:** swapped imports across 9 files — [GitFileRow](../src/renderer/src/screens/git/common/GitFileRow.tsx), [GitFileDiffItem](../src/renderer/src/screens/git/common/GitFileDiffItem.tsx), [GitSidebar](../src/renderer/src/screens/git/sidebar/GitSidebar.tsx), [GitSidebarBranchRow](../src/renderer/src/screens/git/sidebar/GitSidebarBranchRow.tsx), [GitSidebarBranchFolder](../src/renderer/src/screens/git/sidebar/GitSidebarBranchFolder.tsx), [GitSidebarSectionHeader](../src/renderer/src/screens/git/sidebar/GitSidebarSectionHeader.tsx), [GitActionButton](../src/renderer/src/screens/git/actions/GitActionButton.tsx), [GitActionsPanel](../src/renderer/src/screens/git/actions/GitActionsPanel.tsx), [GitCommitGraph](../src/renderer/src/screens/git/commitGraph/GitCommitGraph.tsx). Swapped `Tooltip`, `Spinner`, `ResizeHandle`, `PathDisplay`, plus 13 icons (`IconArchive`, `IconArrowDown`, `IconArrowUp`, `IconBranch`, `IconChevron`, `IconChevronDown`, `IconCommit`, `IconDelete`, `IconDoubleUp`, `IconFastMerge`, `IconFolder`, `IconFolderOpen`, `IconGlobe`, `IconPullRequest`, `IconRefresh`, `IconRevert`).
- **No prop drift** — every swap was a same-shape import rewrite. GitFileDiffItem's `StructuredUnifiedDiff` import stays local for now (covered by Step 8b's `DiffViewer` swap).
- **Polish surfaced during verification (same day, all local — these files are still on the un-swapped local primitives until Step 8b):**
  - Sidebar branch-row chips (`L` / `R`) — added a 1px subtle border (`border-neutral-300 dark:border-neutral-700` for `L`, `border-sky-300 dark:border-sky-700/60` for `R`) so they don't dissolve into the surrounding row hover-bg. [src/renderer/src/screens/git/sidebar/GitSidebarBranchRow.tsx](../src/renderer/src/screens/git/sidebar/GitSidebarBranchRow.tsx).
  - **Stage Hunk** / **Stage Selected** buttons recoloured `bg-teal-600` → `bg-green-600` (with matching hover/active). Aligns with the additions-are-green convention used in the diff hunks themselves; the previous teal was visually disconnected. **Discard** stays `bg-red-600` (matches destructive convention). [src/renderer/src/components/chat/tool-popups/diffUtils.tsx](../src/renderer/src/components/chat/tool-popups/diffUtils.tsx), [src/renderer/src/components/ui/DiffViewer.tsx](../src/renderer/src/components/ui/DiffViewer.tsx).
  - DiffViewer Row 3 (selection actions toolbar) — added `gap-2` to the parent flex so there's an unconditional 8 px gap between the left cluster (Stage / Discard Selected) and the right cluster (Resolve Conflicts / Exit Selection). Previously the `flex-1` on the left section let the right cluster shrink up against it at narrow widths.
  - GitLocalChanges vertical `<ResizeHandle>` (between file lists and diff viewer) — bumped from `z-10` → `z-30` so the handle stays above every sticky element inside the diff viewer. The diff stacks sticky elements at multiple z's: left-gutter columns at `z-10`, hunk headers and the inner row labels at `z-20`. Anything below `z-30` got painted over in some region. [src/renderer/src/screens/git/GitLocalChanges.tsx](../src/renderer/src/screens/git/GitLocalChanges.tsx).

##### Step 8b — Top-level views + DiffViewer _(shipped 2026-05-12)_

- **Implementation:** swapped `Spinner`, `Tooltip`, `ResizeHandle`, `PathDisplay`, `DiffViewer`, plus the `StructuredUnifiedDiff` + `IntraMode` imports that 8a left behind. Five files changed: [screens/git/GitBranchDetailsPanel.tsx](../src/renderer/src/screens/git/GitBranchDetailsPanel.tsx), [screens/git/GitCommitChanges.tsx](../src/renderer/src/screens/git/GitCommitChanges.tsx), [screens/git/GitLocalChanges.tsx](../src/renderer/src/screens/git/GitLocalChanges.tsx), [screens/git/common/GitFileDiffItem.tsx](../src/renderer/src/screens/git/common/GitFileDiffItem.tsx). [screens/GitView.tsx](../src/renderer/src/screens/GitView.tsx) needed no swap — it only imports screen-sibling components.
- **Now orphaned for the Git surface (still used by chat tool-popups; deleted in Step 13):** [components/ui/DiffViewer.tsx](../src/renderer/src/components/ui/DiffViewer.tsx). The local [components/chat/tool-popups/diffUtils.tsx](../src/renderer/src/components/chat/tool-popups/diffUtils.tsx) stays — `WriteToolsPreview`, `WriteMultiToolsPreview`, `SimpleUnifiedDiff`, `InlineTextDiff` chat-side consumers still go through it. They get swapped to `thefactory-ui/web` in a follow-up; not part of Step 8.
- **Upstream:** ported the Step 8a polish that's specific to the diff component into `thefactory-ui` so it landed when the swap flipped — Stage Hunk + Stage Selected recoloured teal → green, and the Row 3 toolbar parent given `gap-2`. The local copies in `components/ui/DiffViewer.tsx` and `components/chat/tool-popups/diffUtils.tsx` retain the same polish for now since they're still mounted in chat — when Step 13 deletes them, the package version becomes the sole copy.
- **Polish surfaced during verification (same day):**
  - Added `--surface-muted` to [src/renderer/src/styles/design-tokens.css](../src/renderer/src/styles/design-tokens.css) for both light (`#f3f4f6`) and dark (`#0e141d`). The package's `DiffViewer` toolbar uses `bg-(--surface-muted)` (file-name row, view-options row, selection-actions row); before the patch the variable was undefined in the compiled CSS, the `var()` resolved to nothing, and the rows rendered white instead of the expected light gray. See the Open Question above for the deeper layer-order cause.

##### Step 8c — Modals (commit / create-branch / checkout / stash / merge) _(shipped 2026-05-12)_

- **Implementation:** swapped `Modal`, `Button`, `Spinner`, `SegmentedControl`, `Tooltip`, `IconFastMerge`, `IntraMode` imports in all five modal files: [GitCommitModal](../src/renderer/src/screens/git/modals/GitCommitModal.tsx), [GitCreateBranchModal](../src/renderer/src/screens/git/modals/GitCreateBranchModal.tsx), [GitCheckoutRemoteModal](../src/renderer/src/screens/git/modals/GitCheckoutRemoteModal.tsx), [GitStashModal](../src/renderer/src/screens/git/modals/GitStashModal.tsx), [GitMergeModal](../src/renderer/src/screens/git/modals/merge/GitMergeModal.tsx).
- **Upstream:** added a `panelClassName?: string` prop to the package `Modal` (parallel to `contentClassName` from Step 5c). Three modals (`GitCheckoutRemoteModal`, `GitCreateBranchModal`, `GitStashModal`) pass `panelClassName="w-[420px]"` to pin a specific width; the package's `size="lg"` preset (`max-w-lg` = 32rem) doesn't land at that exact value, and using `size="md"` would have shifted the width 28 px — large enough to feel different in side-by-side. The new prop keeps the original geometry while still using the package surface.
- **Polish surfaced during verification (same day):**
  - **Branch-name input in `GitCreateBranchModal` + local-branch-name input in `GitCheckoutRemoteModal`** — were raw `<input className="input input-bordered ...">` (DaisyUI-style classes that don't exist in this codebase, so the inputs rendered borderless). Replaced with the package `<Input>` primitive so they match every other input in the app. The `GitStashModal` and `GitCommitModal` already render their own explicitly-styled `<input>` / `<textarea>`, left as-is. [GitCreateBranchModal.tsx](../src/renderer/src/screens/git/modals/GitCreateBranchModal.tsx), [GitCheckoutRemoteModal.tsx](../src/renderer/src/screens/git/modals/GitCheckoutRemoteModal.tsx).
  - **`GitFileRow` row-hover action click target** — pills layer + actions layer sit in the same CSS Grid cell and cross-fade on row hover. The pills layer is non-interactive but was still in the hit-test plane, intercepting some clicks on the SVG icons. Added `pointer-events-none` to the pills layer, and `relative z-10 pointer-events-none group-hover:pointer-events-auto` to the actions layer so the buttons are only clickable when the row is hovered (and unambiguously the topmost layer in that state). [src/renderer/src/screens/git/common/GitFileRow.tsx](../src/renderer/src/screens/git/common/GitFileRow.tsx).
  - **"Uncommitted changes" stub stuck after resetting the last file** — `GitView.changedCount` was only refreshed by an initial `loadCleanStatus()` call and a `git:refresh-now` event listener. When the user reset the last working-tree file inside `GitLocalChanges`, the component's internal status correctly went empty but the parent's `changedCount` stayed > 0, so `GitCommitGraph` kept rendering the "Uncommitted changes" row at the top. Wired the existing `GitLocalChanges.onStatusChange` callback through `GitBranchDetailsPanel` (new `onLocalStatusChange?: (count: number) => void` prop) into `GitView`, where it updates both `changedCount` and `isClean`. The wiring means `changedCount` is now sourced directly from the same data `GitLocalChanges` already reads. [GitView.tsx](../src/renderer/src/screens/GitView.tsx), [GitBranchDetailsPanel.tsx](../src/renderer/src/screens/git/GitBranchDetailsPanel.tsx).
  - **Commit-graph ref chips wrapped to a second row** — the `<span>` wrapping the per-commit refs (HEAD / branch / remote / tag chips) used `flex-wrap`, so when too many chips appeared they wrapped onto a second line and overflowed the fixed 32 px row height. Switched to `flex-nowrap overflow-hidden max-w-full` on the wrapper and `shrink-0 whitespace-nowrap` on each chip — chips now clip cleanly at the right edge of the description column and the user can resize the column wider to see them all. _(Follow-up nicety, deferred: progressively contract leading folder segments — `origin/feature/xyz` → `o.../f.../xyz` — when the chip list would overflow, expanding back as space appears. Needs DOM-measurement + a per-segment shortener; not blocking.)_  [src/renderer/src/screens/git/commitGraph/GitCommitGraphRow.tsx](../src/renderer/src/screens/git/commitGraph/GitCommitGraphRow.tsx).

##### Step 8d — MergeConflictResolver

- **Files:** [screens/git/mergeConflict/MergeConflictResolver.tsx](../src/renderer/src/screens/git/mergeConflict/MergeConflictResolver.tsx) (1099 lines — standalone enough to land alone).
- **Swap:** `Button`, `Spinner`, `Tooltip`, plus a `ConfirmDialog` for any discard-conflict prompt that's currently inline.
- **Compare:** the merge-conflict UI loads the conflicted files, accept-theirs / accept-ours / accept-both / hunk-level resolution still works, the bottom action bar enables/disables correctly.
- **Risk:** medium — this screen is rarely exercised. Verify against a real merge-conflict state, not just a clean tree.

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

- **Custom theme colors use arb-value CSS-var syntax, not named utilities.** _2026-05-12._ When the package needs a colour from its own palette (e.g. `--color-brand-600`), it uses Tailwind v4's arbitrary-value syntax — `bg-(--color-brand-600)`, `border-(--color-brand-600)` — rather than named utilities like `bg-brand-600`. Reason: named utilities require the consumer's Tailwind to register the package's `@theme inline { --color-brand-N: var(--color-brand-N); }` block, which proved fragile downstream (didn't fire for overseer-local even with the canonical `@import "tailwindcss";` entry and the package path added to `content`). The arb-value form is robust because the CSS variable is always defined by the package's `tokens.css`. Tailwind v4's default-palette colours (emerald, teal, purple, …) still work as named utilities since they don't rely on the `@theme` block. Same rule now documented in [thefactory-ui ARCHITECTURE.md](../../thefactory-ui/docs/ARCHITECTURE.md) so future package contributors don't reintroduce it.

## D. Deferred swaps

Components whose `thefactory-ui` equivalent is API-incompatible or feature-incomplete enough that an in-kind swap would be a regression. Each entry, when added, lists why and what needs to happen before we can swap. Items get scheduled into specific Steps above as soon as they have a concrete plan.

_(empty — `RichText` is now Step 5d, `useToast/ToastProvider` is Step 5e, `FileSelector` is Step 6a, `FileMentionsTextarea` is Step 6b.)_

---

## Non-goals

- Adding new features to the desktop app while migrating. Each step is an in-kind swap.
- Porting Electron / IPC chrome into `thefactory-ui`. Window controls, native menus, file-system bridges, `dbService` — all stay in `overseer-local`.
- Touching `thefactory-overseer-web` until this conversion has drained. The web app rebuilds from the package automatically on the next install.
- Refactoring screens during the migration. If a screen feels wrong, file a follow-up; don't fold it into a primitive-swap PR.
