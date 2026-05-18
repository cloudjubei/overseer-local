/**
 * Date formatting helpers. All are tolerant of bad input (returns a string
 * fallback rather than throwing) so they're safe to use directly in JSX.
 */

type DateLike = Date | string | number

/** "Apr 30, 2026" — short calendar date, no time. */
export function formatDateShort(value: DateLike): string {
  const date = toDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** "4/30/2026, 10:45:13 AM" — locale-aware date + time. */
export function formatDateTime(value: DateLike): string {
  const date = toDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  return date.toLocaleString()
}

function toDate(value: DateLike): Date | null {
  // Unix seconds (git timestamps come this way).
  const raw = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  return Number.isNaN(raw.getTime()) ? null : raw
}
