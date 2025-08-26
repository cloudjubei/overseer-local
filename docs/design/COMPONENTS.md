# Component Guidelines and Usage

Overview
- These guidelines define states, variants, and token usage for core UI components. Components should consume semantic tokens and adhere to Linear-like interaction patterns, with Monday-like color accents where appropriate.

Button
- Variants: Primary (accent), Secondary (surface), Destructive (red accent), Ghost (transparent), Link.
- States: default, hover, active, focus, disabled, loading.
- Tokens: background accent.primary; text text.inverted; borders from border tokens for secondary/ghost.
- Behavior: small (control-h-sm), medium (md), large (lg); loading overlays Spinner and disables interactions.

Input/Textarea
- Tokens: background surface.raised; border border.default; focus border-focus with visible focus ring.
- States: default, hover (slightly darker bg), focus, invalid (use red-500/600 border), disabled.
- Keyboard: label connected by for/id; Enter submits forms; Esc cancels inline edits.

Select/Picker
- Tokens: like Input; menu uses surface.overlay with shadow-2; options hover background tinted; focus roving tabindex.
- Type-ahead for long lists; aligns with Linear’s quick pickers.

Modal
- Tokens: surface.overlay, shadow-3/4; backdrop with blur and alpha.
- Behavior: focus trap; Esc to close; Cmd/Ctrl+Enter to confirm.
- Sizes: small/medium/large; responsive widths.

Toast
- Tokens: surface.overlay; shadow-2; success (green), info (brand), error (red) accents; auto dismiss 3–5s.
- ARIA live region polite/assertive depending on severity.

Tooltip
- Tokens: surface.overlay; border.default; shadow-2; max-width 260px.
- Behavior: shows on hover/focus with slight delay; positioned relative to trigger.

Spinner
- Tokens: ui-spinner__indicator uses accent.primary; track uses border.default mix.
- Sizes: 16, 20, 24; use with loading states and Inline loading in buttons and lists.

Skeleton
- Tokens: uses surface-raised + subtle shimmer; rounded radii-2; use for perceived performance on lists/cards.

Command Menu
- Behavior: global overlay (Cmd/Ctrl+K); search input with results; keyboard navigation; Enter executes.
- Tokens: surface.overlay; shadow-3; border.subtle; see src/index.css for class hooks.

Shortcuts Help
- Behavior: overlay showing active shortcuts (?) grouped by scope.
- Accessibility: role dialog; close on Esc.

StatusBadge
- Variants: soft (default in dense lists/boards) and bold (for emphasis or headers).
- Tokens: status.* soft/bold pairs; rounded pill shape.

PriorityTag
- Tiers: P0 (red), P1 (orange), P2 (blue), P3 (gray); soft backgrounds with strong border for readability.
- Use in metadata rows, not as the sole indicator of urgency.

TaskCard
- Tokens: surface.raised; border.default; shadow-1; hover elevates to shadow-2 and nudges; quick actions appear on hover.
- Behavior: keyboard focusable; Enter opens details panel; S/A/P/L/D shortcuts route to pickers.

Density and Layout
- Compact mode uses smaller control heights and spacing tokens (space-3/4) to increase information density.

Do’s and Don’ts
- Do: use semantic tokens; ensure visible focus; keep hover effects subtle.
- Don’t: rely on color only to convey meaning; introduce hex values in component files; add large motion.

References
- For interactions and shortcuts see docs/ux/LINEAR_UX_GUIDELINES.md.
- For color tokens see docs/design/DESIGN_TOKENS.md and MONDAY_PALETTE_REFERENCE.md.
