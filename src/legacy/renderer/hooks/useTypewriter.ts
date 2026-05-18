import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Typewriter hook that progressively reveals the provided text.
 *
 * Key properties:
 * - Does NOT reset when `text` updates; instead it advances from the currently
 *   displayed length toward the new target length. This prevents dropped first
 *   characters when content streams in incrementally.
 * - Uses rAF timing with an accumulator to add 1+ chars per frame based on
 *   ms-per-char. This is smoother and avoids timer clamping pitfalls.
 * - Guards against React 18 Strict Mode double-effect by using a generation token.
 */
export function useTypewriter(text: string, speed: number = 50) {
  // Rendered text
  const [displayText, setDisplayText] = useState('')

  // Refs to avoid stale closures and manage animation lifecycle
  const targetRef = useRef<string>(text)
  const shownLenRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  const accMsRef = useRef<number>(0)
  const lastTsRef = useRef<number | null>(null)
  const genRef = useRef<number>(0)

  // Convert speed (ms per char) to a clamped value to avoid overly small intervals
  const msPerChar = Math.max(16, Math.floor(speed || 0))

  const skipToEnd = useCallback(() => {
    const target = targetRef.current || ''
    const targetLen = target.length

    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = null

    shownLenRef.current = targetLen
    accMsRef.current = 0
    lastTsRef.current = null

    setDisplayText(target)
  }, [])

  // Keep the latest target text in a ref and kick the loop if target grows
  useEffect(() => {
    targetRef.current = text || ''
    const targetLen = targetRef.current.length
    const shownLen = shownLenRef.current

    if (shownLen > targetLen) {
      // If target shrank, clamp immediately (rare)
      shownLenRef.current = targetLen
      setDisplayText(targetRef.current.slice(0, targetLen))
    } else if (shownLen < targetLen) {
      // New characters became available; ensure the loop is running
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  // Restart timing when speed changes
  useEffect(() => {
    // Restart loop with new timing without resetting progress
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = null
    accMsRef.current = 0
    lastTsRef.current = null
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msPerChar])

  // Initialize on mount
  useEffect(() => {
    // Fresh start for a new mount
    genRef.current += 1
    shownLenRef.current = 0
    setDisplayText('')
    accMsRef.current = 0
    lastTsRef.current = null
    start()
    return () => {
      // Cancel any pending animation frame on unmount
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loop(thisGen: number) {
    // If a newer generation started, abort this loop
    if (thisGen !== genRef.current) return

    const target = targetRef.current
    const targetLen = target.length

    let shownLen = shownLenRef.current

    // If already done, no need to continue until new text arrives
    if (shownLen >= targetLen) {
      rafIdRef.current = null
      return
    }

    const now = performance.now()
    const last = lastTsRef.current
    lastTsRef.current = now
    if (last !== null) accMsRef.current += now - last

    let advanced = 0
    while (accMsRef.current >= msPerChar && shownLen < targetLen) {
      shownLen += 1
      accMsRef.current -= msPerChar
      advanced += 1
    }

    if (advanced > 0) {
      shownLenRef.current = shownLen
      setDisplayText(target.slice(0, shownLen))
    }

    // Continue loop if not finished
    if (shownLen < targetLen) {
      rafIdRef.current = requestAnimationFrame(() => loop(thisGen))
    } else {
      rafIdRef.current = null
    }
  }

  function start() {
    // Start a new generation if nothing is running
    if (rafIdRef.current !== null) return
    genRef.current += 1
    lastTsRef.current = null
    rafIdRef.current = requestAnimationFrame(() => loop(genRef.current))
  }

  const isTyping = shownLenRef.current < targetRef.current.length

  return { displayText, isTyping, skipToEnd }
}
