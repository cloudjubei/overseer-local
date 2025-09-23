import React from 'react'

export function formatHmsCompact(ms?: number): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad2 = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}h`
  if (minutes > 0) return `${minutes}:${pad2(seconds)}m`
  return `${seconds}s`
}

export function timeAgo(from: number, to: number) {
  const diff = Math.max(0, from - to)
  const minutes = Math.floor(diff / 60000)
  if (minutes <= 0) return 'just now'
  if (minutes === 1) return '1 minute ago'
  if (minutes < 60) return `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours === 1) return '1 hour ago'
  return `${hours} hours ago`
}
