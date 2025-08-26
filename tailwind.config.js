module.exports = {
  darkMode: [
    'class',
    '[data-theme="dark"]',
  ],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palettes mapped to CSS variables for runtime theming
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
        green: {
          50: 'var(--color-green-50)', 100: 'var(--color-green-100)', 200: 'var(--color-green-200)', 300: 'var(--color-green-300)',
          400: 'var(--color-green-400)', 500: 'var(--color-green-500)', 600: 'var(--color-green-600)', 700: 'var(--color-green-700)',
          800: 'var(--color-green-800)', 900: 'var(--color-green-900)'
        },
        orange: {
          50: 'var(--color-orange-50)', 100: 'var(--color-orange-100)', 200: 'var(--color-orange-200)', 300: 'var(--color-orange-300)',
          400: 'var(--color-orange-400)', 500: 'var(--color-orange-500)', 600: 'var(--color-orange-600)', 650: 'var(--color-orange-650)',
          700: 'var(--color-orange-700)', 800: 'var(--color-orange-800)', 900: 'var(--color-orange-900)'
        },
        red: {
          50: 'var(--color-red-50)', 100: 'var(--color-red-100)', 200: 'var(--color-red-200)', 300: 'var(--color-red-300)',
          400: 'var(--color-red-400)', 500: 'var(--color-red-500)', 600: 'var(--color-red-600)', 700: 'var(--color-red-700)',
          800: 'var(--color-red-800)', 900: 'var(--color-red-900)'
        },
        purple: {
          50: 'var(--color-purple-50)', 100: 'var(--color-purple-100)', 200: 'var(--color-purple-200)', 300: 'var(--color-purple-300)',
          400: 'var(--color-purple-400)', 500: 'var(--color-purple-500)', 600: 'var(--color-purple-600)', 650: 'var(--color-purple-650)',
          700: 'var(--color-purple-700)', 800: 'var(--color-purple-800)', 900: 'var(--color-purple-900)'
        },
        blue: {
          50: 'var(--color-blue-50)', 100: 'var(--color-blue-100)', 200: 'var(--color-blue-200)', 300: 'var(--color-blue-300)',
          400: 'var(--color-blue-400)', 500: 'var(--color-blue-500)', 600: 'var(--color-blue-600)', 650: 'var(--color-blue-650)',
          700: 'var(--color-blue-700)', 800: 'var(--color-blue-800)', 900: 'var(--color-blue-900)'
        },
        teal: {
          50: 'var(--color-teal-50)', 100: 'var(--color-teal-100)', 200: 'var(--color-teal-200)', 300: 'var(--color-teal-300)',
          400: 'var(--color-teal-400)', 500: 'var(--color-teal-500)', 600: 'var(--color-teal-600)', 700: 'var(--color-teal-700)',
          800: 'var(--color-teal-800)', 900: 'var(--color-teal-900)'
        },
        pink: {
          50: 'var(--color-pink-50)', 100: 'var(--color-pink-100)', 200: 'var(--color-pink-200)', 300: 'var(--color-pink-300)',
          400: 'var(--color-pink-400)', 500: 'var(--color-pink-500)', 600: 'var(--color-pink-600)', 700: 'var(--color-pink-700)',
          800: 'var(--color-pink-800)', 900: 'var(--color-pink-900)'
        },

        // Semantics
        surface: { base: 'var(--surface-base)', raised: 'var(--surface-raised)', overlay: 'var(--surface-overlay)' },
        text: { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)', inverted: 'var(--text-inverted)' },
        border: { subtle: 'var(--border-subtle)', DEFAULT: 'var(--border-default)', strong: 'var(--border-strong)', focus: 'var(--border-focus)' },
        accent: { primary: 'var(--accent-primary)', hover: 'var(--accent-primary-hover)', active: 'var(--accent-primary-active)' },

        // Status tokens (bold + soft)
        status: {
          done: { bg: 'var(--status-done-bg)', fg: 'var(--status-done-fg)', soft: { bg: 'var(--status-done-soft-bg)', fg: 'var(--status-done-soft-fg)', border: 'var(--status-done-soft-border)' } },
          working: { bg: 'var(--status-working-bg)', fg: 'var(--status-working-fg)', soft: { bg: 'var(--status-working-soft-bg)', fg: 'var(--status-working-soft-fg)', border: 'var(--status-working-soft-border)' } },
          stuck: { bg: 'var(--status-stuck-bg)', fg: 'var(--status-stuck-fg)', soft: { bg: 'var(--status-stuck-soft-bg)', fg: 'var(--status-stuck-soft-fg)', border: 'var(--status-stuck-soft-border)' } },
          on_hold: { bg: 'var(--status-on_hold-bg)', fg: 'var(--status-on_hold-fg)', soft: { bg: 'var(--status-on_hold-soft-bg)', fg: 'var(--status-on_hold-soft-fg)', border: 'var(--status-on_hold-soft-border)' } },
          review: { bg: 'var(--status-review-bg)', fg: 'var(--status-review-fg)', soft: { bg: 'var(--status-review-soft-bg)', fg: 'var(--status-review-soft-fg)', border: 'var(--status-review-soft-border)' } },
          queued: { bg: 'var(--status-queued-bg)', fg: 'var(--status-queued-fg)', soft: { bg: 'var(--status-queued-soft-bg)', fg: 'var(--status-queued-soft-fg)', border: 'var(--status-queued-soft-border)' } },
          blocked: { bg: 'var(--status-blocked-bg)', fg: 'var(--status-blocked-fg)' }
        },
      },
      ringColor: {
        DEFAULT: 'var(--focus-ring)'
      },
      borderColor: {
        DEFAULT: 'var(--border-default)'
      },
      textColor: theme => ({
        // convenience aliases
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
        inverted: 'var(--text-inverted)'
      }),
      backgroundColor: theme => ({
        base: 'var(--surface-base)',
        raised: 'var(--surface-raised)',
        overlay: 'var(--surface-overlay)'
      }),
    },
  },
  plugins: [],
};
