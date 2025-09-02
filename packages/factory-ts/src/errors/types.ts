export type ErrorCode =
  | 'ABORTED'
  | 'TIMEOUT'
  | 'TRANSIENT'
  | 'RATE_LIMIT'
  | 'NETWORK'
  | 'PROVIDER'
  | 'VALIDATION'
  | 'IO'
  | 'INTERNAL'

export interface ErrorDetails {
  code: ErrorCode
  message: string
  name?: string
  statusCode?: number
  retryAfterMs?: number
  cause?: unknown
  // Optional fields to aid diagnostics, but avoid secrets
  context?: Record<string, unknown>
  stack?: string
}

export class FactoryError extends Error {
  readonly code: ErrorCode
  readonly statusCode?: number
  readonly retryAfterMs?: number
  readonly cause?: unknown
  readonly context?: Record<string, unknown>

  constructor(details: ErrorDetails) {
    super(details.message)
    this.name = details.name ?? 'FactoryError'
    this.code = details.code
    this.statusCode = details.statusCode
    this.retryAfterMs = details.retryAfterMs
    this.cause = details.cause
    this.context = details.context
    if (details.stack) this.stack = details.stack
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      retryAfterMs: this.retryAfterMs,
      context: this.context,
    }
  }
}

export function isAbortError(err: unknown): boolean {
  // Node DOMException-like or AbortError name
  return (
    (err as any)?.name === 'AbortError' ||
    (err as any)?.code === 'ABORT_ERR' ||
    (typeof DOMException !== 'undefined' && err instanceof (DOMException as any) && (err as any).name === 'AbortError')
  )
}

export function isNetworkErrorLike(err: any): boolean {
  const code = err?.code
  const message = String(err?.message ?? '')
  return (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    /timeout/i.test(message) ||
    /network.*error/i.test(message)
  )
}

export function isRateLimitLike(err: any): boolean {
  const status = err?.status ?? err?.statusCode
  const code = err?.code
  const message = String(err?.message ?? '')
  return status === 429 || code === 'rate_limit_exceeded' || /rate limit/i.test(message)
}

export function httpStatus(err: any): number | undefined {
  return err?.status ?? err?.statusCode ?? err?.response?.status
}

export function isServerErrorStatus(status?: number): boolean {
  return !!status && status >= 500 && status < 600
}

export function isTransientError(err: unknown): boolean {
  if (!err) return false
  if (isAbortError(err)) return false
  const status = httpStatus(err)
  if (isRateLimitLike(err) || isServerErrorStatus(status) || isNetworkErrorLike(err)) return true
  // Some provider SDKs tag transient errors
  const code = (err as any)?.code
  if (code === 'TemporaryFailure' || code === 'ECONNABORTED') return true
  return false
}

export function toFactoryError(err: unknown, fallbackMessage = 'Unknown error', context?: Record<string, unknown>): FactoryError {
  if (err instanceof FactoryError) return err
  const status = httpStatus(err)
  const message = typeof (err as any)?.message === 'string' && (err as any).message ? (err as any).message : fallbackMessage
  if (isAbortError(err)) {
    return new FactoryError({ code: 'ABORTED', message, name: (err as any)?.name, statusCode: status, cause: err })
  }
  if (isRateLimitLike(err)) {
    const retryAfter = Number((err as any)?.retryAfter ?? (err as any)?.response?.headers?.['retry-after'])
    const retryAfterMs = Number.isFinite(retryAfter) ? (retryAfter as number) * 1000 : undefined
    return new FactoryError({ code: 'RATE_LIMIT', message, name: (err as any)?.name, statusCode: status, retryAfterMs, cause: err, context })
  }
  if (isNetworkErrorLike(err)) {
    return new FactoryError({ code: 'NETWORK', message, name: (err as any)?.name, statusCode: status, cause: err, context })
  }
  if (isServerErrorStatus(status)) {
    return new FactoryError({ code: 'TRANSIENT', message, name: (err as any)?.name, statusCode: status, cause: err, context })
  }
  // Heuristics
  const code = (err as any)?.code
  if (code === 'ENOENT' || code === 'EACCES') {
    return new FactoryError({ code: 'IO', message, name: (err as any)?.name, statusCode: status, cause: err, context })
  }
  return new FactoryError({ code: 'INTERNAL', message, name: (err as any)?.name, statusCode: status, cause: err, context })
}
