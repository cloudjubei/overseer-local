# Design Tokens: Monday-inspired palette and semantic colors

Purpose
- Capture Monday.com’s vibrant aesthetic while improving accessibility and consistency, and enabling implementation via CSS variables and Tailwind.
- Provide semantic tokens for UI components, status chips, and surfaces with clear mapping to light and dark themes.

Principles
- Vibrant, friendly, high energy: primary and status colors are saturated and cheerful.
- Semantic-first: components pull from semantic tokens, not raw brand hues.
- Accessible by default: define foreground/background pairs that meet WCAG AA where possible; provide soft/bold variants.
- Theming-ready: CSS variables hold the contract; Tailwind consumes via variables so light/dark/themes can swap values.
- Predictable scales: 50..900 for palettes (lightest to darkest); status tokens offer soft (tinted) and bold (solid) variants.

Token taxonomy
- Core palette tokens (raw brand/neutral scales):
  - color.{brand|gray|blue|green|yellow|orange|red|pink|purple|teal}.{50..900}
- Semantic role tokens (map to core):
  - surface.{base,raised,overlay}
  - text.{primary,secondary,muted,inverted}
  - border.{subtle,default,strong,focus}
  - accent.{primary,hover,active}
  - focus.ring
- Status tokens (Monday-style): pairs of background/foreground and soft/bold usage:
  - status.{done,working,stuck,on_hold,review,queued,blocked}.{bg,fg}
  - status.{name}.soft.{bg,fg}

Monday-inspired palette reference (approximated)
See docs/design/MONDAY_PALETTE_REFERENCE.md for the raw list and notes. Key anchors:
- Primary brand (Monday Blue): #0073EA (approx.)
- Done (Green): #00C875
- Working (Orange): #FDAB3D
- Stuck (Red/Pink): #E2445C
- On Hold (Purple): #A25DDC
- Review (Blue): #579BFC
- Queued (Grey): #C4C4C4
- Teal Accent: #00D1D1
- Pink Accent: #FF158A

Accessibility and contrast guidance
- Bold status chips: generally use white text when the background is medium/dark enough to meet AA for 14pt+ (3.0:1 for large text, but target 4.5:1 where feasible). Orange/yellow tones usually require dark text.
- Soft status chips: use a tinted background (mix color with transparent) with a matching 600-700 border and dark text for AA.
- For body text and controls, always use semantic text tokens (text.primary etc.).

Implementation: CSS variables
Add the following CSS to src/styles/design-tokens.css and include it early in your app (e.g., import in src/index.css). Variables are arranged so that semantics map to palette.

Code (light theme)
:root {
  /* Neutral scale (approx.) */
  --color-gray-50:  #F9FAFB;
  --color-gray-100: #F3F4F6;
  --color-gray-200: #E5E7EB;
  --color-gray-300: #D1D5DB;
  --color-gray-400: #9CA3AF;
  --color-gray-500: #6B7280;
  --color-gray-600: #4B5563;
  --color-gray-700: #374151;
  --color-gray-800: #1F2937;
  --color-gray-900: #111827;

  /* Brand primary (Monday Blue-ish) */
  --color-brand-50:  #E6F1FE;
  --color-brand-100: #CCE3FD;
  --color-brand-200: #99C7FB;
  --color-brand-300: #66ABF8;
  --color-brand-400: #338FF4;
  --color-brand-500: #0F7EEB; /* alt: #2B88F0 */
  --color-brand-600: #0073EA; /* Monday-ish anchor */
  --color-brand-700: #005DC1;
  --color-brand-800: #004798;
  --color-brand-900: #00316F;

  /* Vibrant accent families (approx. Monday labels spectrum) */
  --color-green-50:  #E6FBF4;
  --color-green-100: #CFF7EA;
  --color-green-200: #9FF0D5;
  --color-green-300: #6FE8C0;
  --color-green-400: #3FE1AB;
  --color-green-500: #1ED79B;
  --color-green-600: #00C875; /* Done */
  --color-green-700: #00A862;
  --color-green-800: #00884F;
  --color-green-900: #00683C;

  --color-orange-50:  #FFF5E9;
  --color-orange-100: #FFE8CC;
  --color-orange-200: #FFD199;
  --color-orange-300: #FFB966;
  --color-orange-400: #FDA23D;
  --color-orange-500: #FD9826;
  --color-orange-600: #FD8E0F; /* deep working */
  --color-orange-650: #FDAB3D; /* Working on it (anchor) */
  --color-orange-700: #D97500;
  --color-orange-800: #B15F00;
  --color-orange-900: #8A4A00;

  --color-red-50:  #FDECEE;
  --color-red-100: #F9D0D5;
  --color-red-200: #F3A1AB;
  --color-red-300: #ED7381;
  --color-red-400: #E84A5E;
  --color-red-500: #E4445A;
  --color-red-600: #E2445C; /* Stuck */
  --color-red-700: #C22F45;
  --color-red-800: #A02137;
  --color-red-900: #7D172A;

  --color-purple-50:  #F5ECFB;
  --color-purple-100: #E6D1F8;
  --color-purple-200: #CDA3F1;
  --color-purple-300: #B375EA;
  --color-purple-400: #9B55E2;
  --color-purple-500: #8B47DA;
  --color-purple-600: #7B3DD0;
  --color-purple-650: #A25DDC; /* On Hold (anchor-ish in mid) */
  --color-purple-700: #6632C2;
  --color-purple-800: #4F26A0;
  --color-purple-900: #3B1C7D;

  --color-blue-50:   #EFF6FF;
  --color-blue-100:  #DBEAFE;
  --color-blue-200:  #BFDBFE;
  --color-blue-300:  #93C5FD;
  --color-blue-400:  #60A5FA;
  --color-blue-500:  #3B82F6;
  --color-blue-600:  #2563EB;
  --color-blue-650:  #579BFC; /* Review (anchor) */
  --color-blue-700:  #1D4ED8;
  --color-blue-800:  #1E40AF;
  --color-blue-900:  #1E3A8A;

  --color-teal-50:   #E6FBFC;
  --color-teal-100:  #CCF7F8;
  --color-teal-200:  #99EFF1;
  --color-teal-300:  #66E8EA;
  --color-teal-400:  #33E0E3;
  --color-teal-500:  #14D6D9;
  --color-teal-600:  #00D1D1;
  --color-teal-700:  #00A8A8;
  --color-teal-800:  #008080;
  --color-teal-900:  #005858;

  --color-pink-50:   #FFE9F4;
  --color-pink-100:  #FFD1E8;
  --color-pink-200:  #FFA3D1;
  --color-pink-300:  #FF75BA;
  --color-pink-400:  #FF47A3;
  --color-pink-500:  #FF2E97;
  --color-pink-600:  #FF158A; /* Accent */
  --color-pink-700:  #D80A73;
  --color-pink-800:  #B0075E;
  --color-pink-900:  #880449;

  /* Base semantics */
  --surface-base: var(--color-gray-50);
  --surface-raised: #FFFFFF;
  --surface-overlay: #FFFFFF;

  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-700);
  --text-muted: var(--color-gray-600);
  --text-inverted: #FFFFFF;

  --border-subtle: var(--color-gray-200);
  --border-default: var(--color-gray-300);
  --border-strong: var(--color-gray-400);
  --border-focus: var(--color-brand-500);

  --accent-primary: var(--color-brand-600);
  --accent-primary-hover: var(--color-brand-700);
  --accent-primary-active: var(--color-brand-800);

  --focus-ring: var(--color-brand-400);

  /* Status: bold (solid) */
  --status-done-bg: var(--color-green-600);
  --status-done-fg: #053B2E; /* dark text for improved AA */

  --status-working-bg: var(--color-orange-650);
  --status-working-fg: #231200; /* dark text for orange/yellow */

  --status-stuck-bg: var(--color-red-600);
  --status-stuck-fg: #FFFFFF; /* red is dark enough */

  --status-on_hold-bg: var(--color-purple-650);
  --status-on_hold-fg: #FFFFFF;

  --status-review-bg: var(--color-blue-650);
  --status-review-fg: #FFFFFF;

  --status-queued-bg: #EAEAEA; /* light grey */
  --status-queued-fg: var(--color-gray-800);

  --status-blocked-bg: #B42318; /* deeper red */
  --status-blocked-fg: #FFFFFF;

  /* Status: soft (tinted backgrounds, borders, dark text) */
  --status-done-soft-bg: color-mix(in srgb, var(--color-green-600) 15%, transparent);
  --status-done-soft-fg: var(--color-green-800);
  --status-done-soft-border: var(--color-green-400);

  --status-working-soft-bg: color-mix(in srgb, var(--color-orange-650) 18%, transparent);
  --status-working-soft-fg: var(--color-orange-800);
  --status-working-soft-border: var(--color-orange-400);

  --status-stuck-soft-bg: color-mix(in srgb, var(--color-red-600) 12%, transparent);
  --status-stuck-soft-fg: var(--color-red-700);
  --status-stuck-soft-border: var(--color-red-400);

  --status-on_hold-soft-bg: color-mix(in srgb, var(--color-purple-650) 12%, transparent);
  --status-on_hold-soft-fg: var(--color-purple-700);
  --status-on_hold-soft-border: var(--color-purple-400);

  --status-review-soft-bg: color-mix(in srgb, var(--color-blue-650) 12%, transparent);
  --status-review-soft-fg: var(--color-blue-700);
  --status-review-soft-border: var(--color-blue-400);

  --status-queued-soft-bg: color-mix(in srgb, var(--status-queued-bg) 30%, transparent);
  --status-queued-soft-fg: var(--status-queued-fg);
  --status-queued-soft-border: #D4D4D4;
}

/* Dark theme override */
[data-theme="dark"] {
  --surface-base: #0B0F14;
  --surface-raised: #121821;
  --surface-overlay: #1A2230;

  --text-primary: #F5F7FA;
  --text-secondary: #C8D0DA;
  --text-muted: #96A1AE;
  --text-inverted: #0B0F14;

  --border-subtle: #202937;
  --border-default: #2A3444;
  --border-strong: #3A475C;
  --border-focus: var(--color-brand-400);

  --accent-primary: var(--color-brand-500);
  --accent-primary-hover: var(--color-brand-400);
  --accent-primary-active: var(--color-brand-600);

  --focus-ring: var(--color-brand-400);

  /* Dark: bold statuses slightly dim to reduce glare; keep FG for AA */
  --status-done-bg: color-mix(in srgb, var(--color-green-600) 85%, #0B0F14);
  --status-done-fg: #E9FFF6;

  --status-working-bg: color-mix(in srgb, var(--color-orange-650) 80%, #0B0F14);
  --status-working-fg: #1B1200;

  --status-stuck-bg: color-mix(in srgb, var(--color-red-600) 85%, #0B0F14);
  --status-stuck-fg: #FFF5F6;

  --status-on_hold-bg: color-mix(in srgb, var(--color-purple-650) 85%, #0B0F14);
  --status-on_hold-fg: #F7F1FF;

  --status-review-bg: color-mix(in srgb, var(--color-blue-650) 85%, #0B0F14);
  --status-review-fg: #F2F7FF;

  --status-queued-bg: #313843;
  --status-queued-fg: #E5E7EB;

  /* Soft statuses for dark */
  --status-done-soft-bg: color-mix(in srgb, var(--color-green-600) 18%, transparent);
  --status-done-soft-fg: #BBF7E1;
  --status-done-soft-border: color-mix(in srgb, var(--color-green-600) 60%, transparent);

  --status-working-soft-bg: color-mix(in srgb, var(--color-orange-650) 20%, transparent);
  --status-working-soft-fg: #FFE6C7;
  --status-working-soft-border: color-mix(in srgb, var(--color-orange-650) 60%, transparent);

  --status-stuck-soft-bg: color-mix(in srgb, var(--color-red-600) 16%, transparent);
  --status-stuck-soft-fg: #FFDADF;
  --status-stuck-soft-border: color-mix(in srgb, var(--color-red-600) 60%, transparent);

  --status-on_hold-soft-bg: color-mix(in srgb, var(--color-purple-650) 16%, transparent);
  --status-on_hold-soft-fg: #E7D8FF;
  --status-on_hold-soft-border: color-mix(in srgb, var(--color-purple-650) 60%, transparent);

  --status-review-soft-bg: color-mix(in srgb, var(--color-blue-650) 16%, transparent);
  --status-review-soft-fg: #D9E7FF;
  --status-review-soft-border: color-mix(in srgb, var(--color-blue-650) 60%, transparent);

  --status-queued-soft-bg: color-mix(in srgb, var(--status-queued-bg) 40%, transparent);
  --status-queued-soft-fg: var(--status-queued-fg);
  --status-queued-soft-border: #505963;
}

Tailwind integration (example)
- Do not hardcode hex in Tailwind. Map Tailwind theme colors to CSS variables for runtime theming.
- Either replace tailwind.config.js colors with variables, or add a light wrapper config just for semantic colors.

Example snippet (create docs/tailwind.config.tokens.example.js):
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--color-brand-50)', 100: 'var(--color-brand-100)', 200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)', 400: 'var(--color-brand-400)', 500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)', 700: 'var(--color-brand-700)', 800: 'var(--color-brand-800)', 900: 'var(--color-brand-900)'
        },
        surface: {
          base: 'var(--surface-base)', raised: 'var(--surface-raised)', overlay: 'var(--surface-overlay)'
        },
        text: {
          primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)', inverted: 'var(--text-inverted)'
        },
        border: {
          subtle: 'var(--border-subtle)', DEFAULT: 'var(--border-default)', strong: 'var(--border-strong)', focus: 'var(--border-focus)'
        },
        status: {
          done: { bg: 'var(--status-done-bg)', fg: 'var(--status-done-fg)' },
          working: { bg: 'var(--status-working-bg)', fg: 'var(--status-working-fg)' },
          stuck: { bg: 'var(--status-stuck-bg)', fg: 'var(--status-stuck-fg)' },
          on_hold: { bg: 'var(--status-on_hold-bg)', fg: 'var(--status-on_hold-fg)' },
          review: { bg: 'var(--status-review-bg)', fg: 'var(--status-review-fg)' },
          queued: { bg: 'var(--status-queued-bg)', fg: 'var(--status-queued-fg)' },
          blocked: { bg: 'var(--status-blocked-bg)', fg: 'var(--status-blocked-fg)' }
        }
      }
    }
  }
}

Usage patterns
- Component backgrounds and cards: use surface.base/raised.
- Primary buttons: background accent.primary, hover/active as defined; text text.inverted.
- Inputs/borders: border.subtle/default and focus.ring.
- Status chips: prefer soft variants for lists/boards; bold for key signals.

Contrast testing
- Aim for 4.5:1 for normal text; 3.0:1 for large text (>=18px regular or 14px bold).
- When using bold status with white text, ensure minimum sizes and consider soft variants for dense UIs.

Notes
- Color values are approximations based on publicly observed Monday UI. Replace with verified brand codes if available.
- Electron (Chromium) supports color-mix for soft tints; if targeting older engines, replace with precomputed rgba values.
