/** Pretty-print any value as 2-space-indented JSON, falling back to `String()` for cycles. */
export function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
