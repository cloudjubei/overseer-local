type BeepOptions = {
  /** Hz; defaults to 880 (A5). */
  frequency?: number
  /** Seconds; defaults to 0.12. */
  duration?: number
  /** Linear gain at peak; defaults to 0.05 — quiet by design. */
  gain?: number
}

let sharedCtx: AudioContext | null = null

type GlobalAudio = typeof globalThis & {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

function getCtx(): AudioContext | null {
  if (sharedCtx) return sharedCtx
  if (typeof window === 'undefined') return null
  const g = globalThis as GlobalAudio
  const Ctor = g.AudioContext ?? g.webkitAudioContext
  if (!Ctor) return null
  try {
    sharedCtx = new Ctor()
    return sharedCtx
  } catch {
    return null
  }
}

/**
 * Plays a brief, quiet sine-wave tone using the WebAudio API. Returns
 * silently when audio is unavailable (jsdom, Safari without user gesture).
 * Uses a single shared `AudioContext` so we don't leak one per call.
 */
export function playBeep(options: BeepOptions = {}): void {
  const { frequency = 880, duration = 0.12, gain = 0.05 } = options
  const ctx = getCtx()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = frequency

  const env = ctx.createGain()
  // Tiny envelope to avoid clicks at start/end.
  env.gain.setValueAtTime(0, now)
  env.gain.linearRampToValueAtTime(gain, now + 0.01)
  env.gain.linearRampToValueAtTime(0, now + duration)

  osc.connect(env).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
}
