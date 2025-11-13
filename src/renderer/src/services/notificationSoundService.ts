import { tryResumeAudioContext, playReceiveSound, playSendSound } from '@renderer/assets/sounds'
import type { NotificationCategory } from 'src/types/notifications'

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
    el.load?.()
    return el
  } catch (_) {
    return null
  }
}

function ensurePreloaded() {
  if (agentAudio || chatAudio || gitAudio) return
  try {
    const base = new URL('../assets/sounds/', import.meta.url)
    agentAudio = safeCreateAudio(new URL('agent.mp3', base).toString())
    chatAudio = safeCreateAudio(new URL('chat.mp3', base).toString())
    gitAudio = safeCreateAudio(new URL('git.mp3', base).toString())
  } catch (_) {}
}

function stopCurrent() {
  if (current) {
    try {
      current.pause()
      current.currentTime = 0
    } catch (_) {}
    current = null
  }
}

function canPlayNow(): boolean {
  const now = Date.now()
  if (now - lastPlayAt < cooldownMs) return false
  lastPlayAt = now
  return true
}

function playWithFallback(audio: HTMLAudioElement | null, fallback?: NotificationCategory) {
  tryResumeAudioContext()

  if (audio) {
    try {
      stopCurrent()
      current = audio
      const clone = audio.cloneNode(true) as HTMLAudioElement
      clone.currentTime = 0
      clone.play()
      return
    } catch (_) {}
  }
  playFallback(fallback)
}

function playFallback(category?: NotificationCategory) {
  if (!category) return

  switch (category) {
    case 'agent_runs':
      playToneSequence([
        { f: 660, d: 80 },
        { f: 520, d: 120, offset: 0.08 },
      ])
      break
    case 'chat_messages':
      playReceiveSound()
      break
    case 'git_changes':
      playToneSequence([
        { f: 320, d: 90 },
        { f: 760, d: 90, offset: 0.09 },
      ])
      break
  }
}

function playToneSequence(seq: { f: number; d: number; offset?: number }[]) {
  try {
    if (seq.length <= 1) {
      playSendSound()
      return
    }
    playSendSound()
    setTimeout(() => playReceiveSound(), Math.max(60, Math.floor((seq[1].offset || 0.1) * 1000)))
  } catch (_) {}
}

export const NotificationSoundService = {
  init() {
    ensurePreloaded()
  },
  play(category: NotificationCategory) {
    if (!canPlayNow()) return
    ensurePreloaded()
    switch (category) {
      case 'agent_runs':
        return playWithFallback(agentAudio, 'agent_runs')
      case 'chat_messages':
        return playWithFallback(chatAudio, 'chat_messages')
      case 'git_changes':
        return playWithFallback(gitAudio, 'git_changes')
    }
  },
}
