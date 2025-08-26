/* Example Tailwind extension mapping to CSS variable tokens */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--color-brand-50)', 100: 'var(--color-brand-100)', 200: 'var(--color-brand-200)',
          300: 'var(--color-brand-300)', 400: 'var(--color-brand-400)', 500: 'var(--color-brand-500)',
          600: 'var(--color-brand-600)', 700: 'var(--color-brand-700)', 800: 'var(--color-brand-800)', 900: 'var(--color-brand-900)'
        },
        gray: {
          50: 'var(--color-gray-50)', 100: 'var(--color-gray-100)', 200: 'var(--color-gray-200)', 300: 'var(--color-gray-300)',
          400: 'var(--color-gray-400)', 500: 'var(--color-gray-500)', 600: 'var(--color-gray-600)', 700: 'var(--color-gray-700)',
          800: 'var(--color-gray-800)', 900: 'var(--color-gray-900)'
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
