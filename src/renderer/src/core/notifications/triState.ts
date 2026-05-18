/**
 * Resolves a per-project tri-state override against a global default.
 *
 * - `override === undefined` → follow the global value
 * - `override === true`      → force on
 * - `override === false`     → force off
 *
 * Used for per-project notification category overrides — applied wherever a
 * category is gated (OS-notification dispatch, sidebar/favicon badges).
 */
export function resolveTriState(global: boolean, override: boolean | undefined): boolean {
  return override ?? global
}
