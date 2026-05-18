/**
 * Mask a secret by showing the first and last 4 characters surrounded by
 * bullets. Safe for display of tokens / API keys in the UI.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '•'.repeat(value.length)
  return `${value.slice(0, 4)}${'•'.repeat(20)}${value.slice(-4)}`
}
