import type { SpeechToTextEngine } from 'thefactory-ui/headless'

/**
 * Desktop adapter for `useSpeechToText`. Reports `isSupported(): false`
 * unconditionally on Electron — see the long comment below for why —
 * so the ChatInput mic button never renders on the desktop client.
 *
 * Electron's bundled Chromium exposes the `webkitSpeechRecognition`
 * constructor but doesn't include Google's speech-recognition service
 * that Chromium normally talks to. In practice `start()` either errors
 * immediately or silently fails — `audiostart` / `speechstart` /
 * `result` / `error` all stay quiet — and the user is left clicking a
 * broken affordance. We've tried surfacing the failure via the
 * `network` error code + a clear modal; the cleaner answer is to not
 * offer the affordance at all until we ship a real engine (hosted STT
 * via Deepgram / Whisper / similar, mounted the same way mobile mounts
 * `expoSpeechEngine`).
 *
 * Detection: presence of `Electron` in the navigator userAgent OR
 * Node-style `process` exposed in the renderer. Both are stable on
 * Electron 30+; either alone is enough.
 *
 * The `start()` implementation is preserved so a future hosted-STT
 * effort can either replace this engine or extend it without
 * re-architecting the wiring. The watchdog is also kept as a defensive
 * net in case a future build flips `isSupported` back to `true`.
 */
const STARTUP_WATCHDOG_MS = 6_000

function isElectronRenderer(): boolean {
  if (typeof navigator !== 'undefined' && /electron/i.test(navigator.userAgent ?? '')) return true
  const w = typeof window !== 'undefined' ? (window as { process?: { type?: string } }) : undefined
  if (w?.process?.type) return true
  return false
}

interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionErrorEventLike {
  error?: string
}

interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null
  onaudiostart: (() => void) | null
  onspeechstart: (() => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike
}

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const webSpeechEngine: SpeechToTextEngine = {
  isSupported() {
    if (isElectronRenderer()) return false
    return getCtor() !== null
  },

  async start({ onPartial, onFinal, onError, locale }) {
    const Ctor = getCtor()
    if (!Ctor) {
      onError('unsupported')
      throw new Error('Web Speech API is not available in this Electron build')
    }
    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = locale ?? 'en-US'

    let started = false
    let stopped = false

    const watchdog = setTimeout(() => {
      if (started || stopped) return
      onError('network')
      stopped = true
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
    }, STARTUP_WATCHDOG_MS)

    const markStarted = () => {
      started = true
      clearTimeout(watchdog)
    }
    rec.onaudiostart = markStarted
    rec.onspeechstart = markStarted
    rec.onstart = markStarted

    rec.onresult = (ev) => {
      // The very first result event also counts as "the engine is
      // alive" — useful when audiostart never fires (older Chromium
      // builds, certain provider routes).
      markStarted()
      let partial = ''
      let final = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i]
        const text = r[0]?.transcript ?? ''
        if (r.isFinal) final += text
        else partial += text
      }
      if (partial) onPartial(partial)
      if (final) onFinal(final)
    }
    rec.onerror = (ev) => {
      clearTimeout(watchdog)
      onError(ev.error ?? 'unknown')
    }
    rec.onend = () => {
      clearTimeout(watchdog)
    }
    rec.start()

    return () => {
      stopped = true
      clearTimeout(watchdog)
      try {
        rec.stop()
      } catch {
        // Calling stop() on an already-stopped recogniser throws in
        // some Chromium builds — non-fatal.
      }
    }
  },
}
