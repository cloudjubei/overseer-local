export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore AbortController reason may not be typed on older TS lib
    const reason = (signal as any).reason
    if (reason instanceof Error) throw reason
    const err = new DOMException('Aborted', 'AbortError')
    throw err
  }
}

export async function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const t = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const cleanup = () => {
      clearTimeout(t)
      if (signal) signal.removeEventListener('abort', onAbort)
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true })
  })
}

export async function withAbort<T>(signal: AbortSignal | undefined, fn: () => Promise<T>): Promise<T> {
  throwIfAborted(signal)
  return await fn()
}
