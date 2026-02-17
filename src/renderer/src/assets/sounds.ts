let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  return audioCtx
}

function playTone({
  frequency = 440,
  durationMs = 120,
  type = 'sine',
  volume = 0.2,
  attackMs = 6,
  releaseMs = 80,
  startTimeOffset = 0,
}: {
  frequency?: number
  durationMs?: number
  type?: OscillatorType
  volume?: number
  attackMs?: number
  releaseMs?: number
  startTimeOffset?: number
}) {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = frequency

  const now = ctx.currentTime + startTimeOffset
  const duration = Math.max(0, durationMs) / 1000
  const attack = Math.max(0, attackMs) / 1000
  const release = Math.max(0, releaseMs) / 1000

  // Envelope
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(volume, now + attack)
  gain.gain.setValueAtTime(volume, now + Math.max(attack, duration - release))
  gain.gain.linearRampToValueAtTime(0.0001, now + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + duration)
}

// Public API
export function playSendSound() {
  // A quick high blip with a slight pitch up
  const ctx = getCtx()
  if (!ctx) return
  // Base blip
  playTone({
    frequency: 820,
    durationMs: 110,
    type: 'sine',
    volume: 0.23,
    attackMs: 5,
    releaseMs: 60,
  })
  // Slight up-chirp overlay
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(720, now)
  osc.frequency.exponentialRampToValueAtTime(1020, now + 0.11)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.12)
}

export function playReceiveSound() {
  // Two-note pleasant confirmation: low -> slightly higher
  // Note A4 (440Hz) then E5 (~659Hz)
  playTone({
    frequency: 440,
    durationMs: 100,
    type: 'sine',
    volume: 0.22,
    attackMs: 6,
    releaseMs: 70,
    startTimeOffset: 0,
  })
  playTone({
    frequency: 660,
    durationMs: 140,
    type: 'sine',
    volume: 0.22,
    attackMs: 6,
    releaseMs: 90,
    startTimeOffset: 0.1,
  })
}

// Optional: expose a mute toggle in the future if needed
export function tryResumeAudioContext() {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}
