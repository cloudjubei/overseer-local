import { describe, it, expect } from 'vitest'
import { retry } from './retry'

function makeFlaky(timesToFail: number, errFactory: () => Error) {
  let count = 0
  return async function run() {
    if (count < timesToFail) {
      count++
      throw errFactory()
    }
    return 'ok'
  }
}

describe('retry', () => {
  it('retries transient errors with backoff', async () => {
    const err = new Error('ECONNRESET') as any
    err.code = 'ECONNRESET'
    let retries = 0
    const res = await retry(makeFlaky(2, () => err), {
      retries: 3,
      minDelayMs: 1,
      maxDelayMs: 5,
      jitter: false,
      onRetry: () => {
        retries++
      },
    })
    expect(res).toBe('ok')
    expect(retries).toBe(2)
  })

  it('bails on non-transient error', async () => {
    const err = new Error('validation failed')
    await expect(
      retry(makeFlaky(1, () => err), { retries: 2, minDelayMs: 1, jitter: false })
    ).rejects.toThrowError('validation failed')
  })

  it('respects AbortSignal cancellation between retries', async () => {
    const controller = new AbortController()
    const err = new Error('ECONNRESET') as any
    err.code = 'ECONNRESET'
    const promise = retry(makeFlaky(5, () => err), {
      retries: 5,
      minDelayMs: 50,
      jitter: false,
      signal: controller.signal,
    })
    // abort shortly after
    setTimeout(() => controller.abort(), 10)
    await expect(promise).rejects.toThrowError(/Aborted/)
  })
})
