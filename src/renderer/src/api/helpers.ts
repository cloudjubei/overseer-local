/**
 * Boundary helpers that don't fit anywhere else.
 *
 * Four jobs:
 *   1. `unwrapGitEnvelope` — the git endpoints wrap their payload in a
 *      `{ ok, error, ... }` envelope. UI code should never see that envelope;
 *      this throws on `ok: false` and returns the named field on success.
 *   2. `isTestRun` / `isCoverage` — narrow the `T | unknown` shape returned
 *      by the test runner's `last-*` endpoints (the spec types them loosely
 *      because no run may have happened yet).
 *   3. `isGrepHit` — narrow the grep result union (hit vs. error).
 *   4. `getResponseDataMessage` — pull `response.data.message` out of an
 *      `unknown` thrown by `throwOnError: true` SDK calls. The hey-api
 *      client throws raw axios errors; the UI wants a readable string.
 */
import type { CoverageResult, TestsResult } from '../generated/backend'
import type { GrepHit, GrepResult, LastCoverageRaw, LastTestsRunRaw } from './types'

/**
 * Several git endpoints wrap their data in a per-call envelope:
 *
 *     ({ ok: true, ... } | { ok: false, error })
 *
 * Where the actual payload sits under one of several keys (`status`,
 * `branches`, `stashes`, …). We throw the server's error message on
 * `ok: false` so a failure can never silently surface as an empty list,
 * and fall back to a caller-provided default when the field is missing
 * on a successful response (the upstream tools sometimes omit it).
 */
export function unwrapGitEnvelope<T extends { ok: boolean; error?: string }, K extends keyof T>(
  envelope: T,
  field: K,
  fallback: NonNullable<T[K]>,
): NonNullable<T[K]> {
  if (envelope.ok === false) {
    throw new Error(envelope.error ?? 'Git operation failed')
  }
  const value = envelope[field]
  return (value ?? fallback) as NonNullable<T[K]>
}

/** True when a `last-*` test endpoint returned a real run (not the empty placeholder). */
export function isTestRun(value: LastTestsRunRaw): value is TestsResult {
  return typeof value === 'object' && value !== null && 'status' in value && 'tests' in value
}

/** True when the `last-coverage` endpoint returned a real coverage report. */
export function isCoverage(value: LastCoverageRaw): value is CoverageResult {
  return typeof value === 'object' && value !== null && 'status' in value && 'files' in value
}

/** True when a single grep entry succeeded (vs. errored on its target file). */
export function isGrepHit(result: GrepResult): result is GrepHit {
  return 'matches' in result
}

/**
 * Pull `response.data.message` out of an unknown thrown by an SDK call made
 * with `throwOnError: true` — that path throws raw `AxiosError` instances,
 * whose `response.data` is the backend's JSON body (e.g. the
 * `OverseerNotEmptyError` envelope). Walks the structure with `unknown`
 * narrowing so consumers don't have to import axios types.
 */
export function getResponseDataMessage(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined
  const response = (err as { response?: unknown }).response
  if (!response || typeof response !== 'object') return undefined
  const data = (response as { data?: unknown }).data
  if (!data || typeof data !== 'object') return undefined
  const message = (data as { message?: unknown }).message
  return typeof message === 'string' ? message : undefined
}

/**
 * Structured view of an SDK error shaped by the backend's standard error
 * envelope. The backend ships:
 *   - `{ error }`                                       on 4xx
 *   - `{ error, code: 'INTERNAL_ERROR', requestId }`    on 5xx
 *
 * UIs that surface errors should prefer `message` for the headline and tack
 * `requestId` on as a copy-able grep handle when present. `code` is intentionally
 * generic today (`INTERNAL_ERROR` is the only value 5xx routes emit) but the
 * field exists so future per-class codes don't break the contract.
 *
 * Falls back gracefully — non-axios throwables (raw `Error`, plain strings,
 * unrelated objects) all surface a sensible `message` so callers don't have
 * to discriminate by error type.
 */
export type ServerError = {
  message: string
  code?: string
  requestId?: string
}

export function extractServerError(err: unknown, fallback = 'Request failed'): ServerError {
  if (err && typeof err === 'object') {
    const data = (err as { response?: { data?: unknown } }).response?.data
    if (data && typeof data === 'object') {
      const d = data as { error?: unknown; message?: unknown; code?: unknown; requestId?: unknown }
      const message =
        (typeof d.error === 'string' && d.error) ||
        (typeof d.message === 'string' && d.message) ||
        undefined
      if (message) {
        return {
          message,
          ...(typeof d.code === 'string' ? { code: d.code } : {}),
          ...(typeof d.requestId === 'string' ? { requestId: d.requestId } : {}),
        }
      }
    }
  }
  if (err instanceof Error && err.message) return { message: err.message }
  if (typeof err === 'string' && err.length > 0) return { message: err }
  return { message: fallback }
}
