/**
 * Extracts a human-readable error message from an IPC or thrown error.
 *
 * Order of preference: `Error.message`, then a string error, then a fallback.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message.trim().length > 0) {
    return err.message
  }
  if (typeof err === 'string' && err.length > 0) return err
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    const m = (err as { message: string }).message
    if (m.trim().length > 0) return m
  }
  return fallback
}
