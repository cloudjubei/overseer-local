import type { AxiosError } from 'axios'

/**
 * Extracts a human-readable error message from a failed backend call.
 *
 * Order of preference: response body's `error` field (set by the Fastify
 * routes), then a status-specific friendly fallback, then the underlying axios
 * message, then `String(err)`.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'isAxiosError' in err) {
    const ax = err as AxiosError<{ error?: string }>
    const fromBody = ax.response?.data?.error
    if (typeof fromBody === 'string' && fromBody.trim().length > 0) return fromBody.trim()
    const status = ax.response?.status
    if (status === 401)
      return 'Not authorized. Check the backend bearer token in Developer settings.'
    if (status === 403) return 'Forbidden: the backend rejected this request.'
    if (status === 404) return 'Not found on the backend.'
    if (status === 408 || ax.code === 'ECONNABORTED') return 'The backend took too long to respond.'
    if (status === 502 || status === 503 || status === 504) {
      return 'The backend is temporarily unavailable. Try again in a moment.'
    }
    if (!ax.response) {
      return 'Could not reach the backend. Check that it is running and reachable.'
    }
  }
  if (err instanceof Error && err.message && err.message.trim().length > 0) return err.message
  if (typeof err === 'string' && err.length > 0) return err
  return fallback
}
