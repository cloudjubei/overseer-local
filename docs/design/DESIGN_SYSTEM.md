# Design System: Monday-style color, Linear-grade UX, and extensible tokens

Overview
- Goal: Match Monday.com's colorful visual language and Linear.app's interaction excellence, while improving accessibility, dark mode, and maintainability.
- Scope: Colors (core + semantic), typography, spacing, elevation, radii, motion, and component guidelines.
- Implementation: CSS variable tokens in src/styles/design-tokens.css, consumed directly and via Tailwind variable mapping.

Design Principles
- Semantic-first: Components use semantic tokens (surface, text, border, accent, status) rather than raw hex values.
- Vibrant but accessible: Monday-like saturation with WCAG-conscious foreground/background pairs.
- Keyboard-first: Linear-like shortcuts and command menu patterns are first-class (see docs/ux/LINEAR_UX_GUIDELINES.md).
- Theming-ready: Light/Dark via attribute [data-theme="dark"] with friendly overrides. Tokens are the contract.
- Extensible scales: Predictable scales allow growth without churn (colors 50..900, typography and spacing tiers).

Foundational Tokens
- Location: src/styles/design-tokens.css
- Token families:
  - color.{brand|gray|blue|green|orange|red|purple|teal|pink}.{50..900}
  - surface.{base|raised|overlay}
  - text.{primary|secondary|muted|inverted}
  - border.{subtle|default|strong|focus}
  - accent.primary{, -hover, -active}
  - focus-ring
  - status.{done|working|stuck|on_hold|review|queued|blocked}.{bg|fg} (+ .soft.{bg|fg|border})
  - typography: font.{sans|mono}, fs.{xxs..3xl}, lh.{tight..relaxed}, fw.{regular|medium|semibold|bold}
  - spacing: space-{0,1,2,3,4,5,6,7,8,10,12,16,20,24,32}
  - radii: radius-{1..5, round}
  - elevation: shadow-{0..4}
  - motion: motion-{fast|normal|slow}, easing-{standard|decelerate|accelerate}
  - z-index: z-{base|sticky|dropdown|tooltip|modal|toast}
  - controls: control-h-{sm|md|lg}, control-pad-x, focus-ring-width

Typography Scale
- Base: 14–16px body with comfortable leading for dense boards.
- Sizes:
  - fs-xxs 10px (caps/badges)
  - fs-xs 12px (meta, labels)
  - fs-sm 14px (body)
  - fs-md 16px (prominent body)
  - fs-lg 18px (section title)
  - fs-xl 20px (subheader)
  - fs-2xl 24px (headers)
  - fs-3xl 30px (page titles)
- Line heights: tight 1.1, snug 1.25, normal 1.45, relaxed 1.6.
- Weights: regular 400, medium 500, semibold 600, bold 700.

Spacing System
- 4px rhythm with half-steps for compact density: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 64.
- Use space tokens in layout and component paddings; avoid raw pixel literals.

Elevation and Surfaces
- shadow-1: subtle lift for cards
- shadow-2: hover/active lifts
- shadow-3: modals/panels
- shadow-4: dialogs and high-emphasis overlays
- In dark mode, shadow alpha is tuned up slightly for contrast but kept soft to avoid glare.

Radii
- radius-2/3/4 are defaults for inputs, cards, and boards; round for chips and status badges.

Motion
- fast (120ms) for micro-interactions, normal (180ms) for most UI changes, slow (240ms) for large overlays.
- easing-standard for generic transitions; decelerate for entrance, accelerate for exit.

Z-index
- tooltip > modal > dropdown > base to avoid stacking conflicts. Use tokens instead of numeric literals.

Color: Monday-inspired, improved
- Anchors: brand #0073EA; done #00C875; working #FDAB3D; stuck #E2445C; on-hold #A25DDC; review #579BFC; queued gray; teal #00D1D1; pink #FF158A.
- Improvements over Monday: explicit FG pairs for orange/yellow use dark text for AA; dark mode tints reduce glare; soft variants standardize borders.

Interaction Patterns: Linear-grade
- Global command (Cmd/Ctrl+K), search (/), help (?) with clear, consistent scopes; see docs/ux/LINEAR_UX_GUIDELINES.md.
- Inline edits, optimistic updates, and undo affordances are baseline behaviors.

Theming
- Add data-theme="dark" on html or body to switch to dark tokens. Keep one DOM; prefer CSS variables over class proliferation.

Tailwind Integration
- Map Tailwind theme colors to CSS variables (see docs/tailwind.config.tokens.example.js). Do not embed hex codes.

Accessibility
- Target 4.5:1 contrast for body text, 3.0:1 for large. Status chips use soft or bold depending on density and contrast needs.
- Focus rings: use focus-ring + focus-ring-width tokens; ensure visible focus on all interactive elements.

Extending the System
- Add new color families by defining the 50..900 steps, then map semantic roles. Avoid adding brand hex directly to components.
- For new components, start with semantic tokens and only introduce component-specific tokens if multiple variants share them.

Examples and Style Guide
- See docs/styleguide/index.html for a live preview of tokens and components (light/dark toggle, density, and interaction demos).
