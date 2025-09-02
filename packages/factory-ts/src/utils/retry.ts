import { abortableDelay } from './abort'
import { FactoryError, isTransientError, toFactoryError } from '../errors/types'

export interface RetryOptions {
  retries?: number
  minDelayMs?: number
  maxDelayMs?: number
  factor?: number
  jitter?: boolean
  signal?: AbortSignal
  classify?: (err: unknown) => 'retry' | 'bail'
  onRetry?: (info: { attempt: number; delayMs: number; error: FactoryError }) => void
}

function computeBackoff(attempt: number, opts: Required<Pick<RetryOptions, 'minDelayMs' | 'maxDelayMs' | 'factor' | 'jitter'>>) {
  const raw = opts.minDelayMs * Math.pow(opts.factor, attempt)
  const withCap = Math.min(raw, opts.maxDelayMs)
  const jitter = opts.jitter ? Math.random() * 0.2 * withCap : 0 // up to 20% jitter
  return Math.round(withCap + jitter)
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    minDelayMs = 250,
    maxDelayMs = 10_000,
    factor = 2,
    jitter = true,
    signal,
    classify,
    onRetry,
  } = options

  let attempt = 0
  // attempt 0 is initial try, then up to retries additional attempts on retry-worthy errors
  for (;;) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    try {
      return await fn()
    } catch (e) {
      const ferr = toFactoryError(e)
      const decision = classify ? classify(ferr) : isTransientError(ferr) ? 'retry' : 'bail'
      if (decision === 'bail' || attempt >= retries) {
        throw ferr
      }
      const delayMs = computeBackoff(attempt, { minDelayMs, maxDelayMs, factor, jitter })
      onRetry?.({ attempt: attempt + 1, delayMs, error: ferr })
      await abortableDelay(delayMs, signal)
      attempt += 1
      continue
    }
  }
}
