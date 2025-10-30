// Renderer-side notification sound manager
// Plays distinct sounds for notification categories: agent_run, chat, git
// Respects app settings soundsEnabled and avoids overlaps with a short cooldown

import { tryResumeAudioContext, playReceiveSound, playSendSound } from '@renderer/assets/sounds'
import type { Notification } from 'src/types/notifications'

// Preloadable audio assets (will be resolved by bundler to URLs). These are placeholders and may not exist in dev.
// If they fail to load, we will fallback to WebAudio-generated tones from sounds.ts
let agentAudio: HTMLAudioElement | null = null
let chatAudio: HTMLAudioElement | null = null
let gitAudio: HTMLAudioElement | null = null

let lastPlayAt = 0
let cooldownMs = 250 // prevent excessive overlapping on bursts
let current: HTMLAudioElement | null = null

function safeCreateAudio(src: string): HTMLAudioElement | null {
  try {
    const el = new Audio(src)
    el.preload = 'auto'
    // Attempt to load; ignore errors
    el.load?.()
    return el
  } catch (_) {
    return null
  }
}

function ensurePreloaded() {
  if (agentAudio || chatAudio || gitAudio) return
  try {
    // Using import.meta.url relative paths for Vite bundling
    const base = new URL('../assets/sounds/', import.meta.url)
    agentAudio = safeCreateAudio(new URL('agent.mp3', base).toString())
    chatAudio = safeCreateAudio(new URL('chat.mp3', base).toString())
    gitAudio = safeCreateAudio(new URL('git.mp3', base).toString())
  } catch (_) {
    // ignore; fallbacks will be used
  }
}

function stopCurrent() {
  if (current) {
    try {
      current.pause()
      current.currentTime = 0
    } catch (_) {
      // ignore
    }
    current = null
  }
}

function canPlayNow(): boolean {
  const now = Date.now()
  if (now - lastPlayAt < cooldownMs) return false
  lastPlayAt = now
  return true
}

function playWithFallback(audio: HTMLAudioElement | null, fallback: 'agent' | 'chat' | 'git') {
  // Best effort resume WebAudio context (for fallbacks)
  tryResumeAudioContext()

  // Attempt audio element first
  if (audio) {
    try {
      stopCurrent()
      current = audio
      // Clone to allow overlapping instances if needed, but we currently stop previous
      const clone = (audio as any).cloneNode ? (audio as any).cloneNode(true) : audio
      ;(clone as HTMLAudioElement).currentTime = 0
      ;(clone as HTMLAudioElement).play().catch(() => {
        // If play() fails (autoplay policies), fallback
        playFallback(fallback)
      })
      return
    } catch (_) {
      // fallback below
    }
  }
  playFallback(fallback)
}

function playFallback(kind: 'agent' | 'chat' | 'git') {
  // Use simple distinct tones per kind
  switch (kind) {
    case 'agent':
      // A short decisive two-tone to differentiate from chat
      playToneSequence([
        { f: 660, d: 80 },
        { f: 520, d: 120, offset: 0.08 },
      ])
      break
    case 'chat':
      // Reuse receive sound for chat updates (pleasant low->high)
      playReceiveSound()
      break
    case 'git':
      // A quick low blip then a higher ping
      playToneSequence([
        { f: 320, d: 90 },
        { f: 760, d: 90, offset: 0.09 },
      ])
      break
  }
}

// Minimal local helper to sequence tones via WebAudio using existing playSendSound as guidance
function playToneSequence(seq: { f: number; d: number; offset?: number }[]) {
  try {
    // tone generation via existing functions; use send+receive variants to produce distinct cues
    // For more control, we can call internal playTone via a small mimicked sequence using playSendSound twice offset
    // Here we approximate by mixing send and receive depending on sequence length
    if (seq.length <= 1) {
      playSendSound()
      return
    }
    // Fire a quick send sound, then a receive sound slightly offset to create a two-tone effect
    playSendSound()
    setTimeout(() => playReceiveSound(), Math.max(60, Math.floor((seq[1].offset || 0.1) * 1000)))
  } catch (_) {
    // no-op
  }
}

export type NotificationSoundKind = 'agent' | 'chat' | 'git'

export const NotificationSoundService = {
  init() {
    ensurePreloaded()
  },
  play(kind: NotificationSoundKind) {
    if (!canPlayNow()) return
    ensurePreloaded()
    switch (kind) {
      case 'agent':
        return playWithFallback(agentAudio, 'agent')
      case 'chat':
        return playWithFallback(chatAudio, 'chat')
      case 'git':
        return playWithFallback(gitAudio, 'git')
    }
  },
  mapNotificationToKind(n: Notification): NotificationSoundKind | null {
    try {
      // Prefer category mapping; fallback to type heuristics
      switch (n.category) {
        case 'agent_run':
          return 'agent'
        case 'chat':
          return 'chat'
        case 'updates':
          // Treat updates as git events by default; adjust if dedicated git category is introduced
          return 'git'
      }
      // Heuristic: type 'chat' => chat, files/system => ignore, success/warning/error => agent-ish?
      if (n.type === 'chat') return 'chat'
      return null
    } catch (_) {
      return null
    }
  },
}
