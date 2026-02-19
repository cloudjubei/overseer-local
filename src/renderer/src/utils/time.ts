function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// Friendly chat-style timestamp:
// - today -> '2:34 PM'
// - this year -> 'Jan 3, 2:34 PM'
// - other year -> 'Jan 3, 2023, 2:34 PM'
export function formatFriendlyTimestamp(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  if (isSameLocalDay(d, now)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
  }
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  if (d.getFullYear() !== now.getFullYear()) {
    opts.year = 'numeric'
  }
  return new Intl.DateTimeFormat(undefined, opts).format(d)
}

// Compact duration label (chat thinking time)
export function formatDurationMs(ms: number): string {
  if (!isFinite(ms) || ms < 0) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const remS = Math.round(s - m * 60)
  if (m < 60) return remS > 0 ? `${m}m ${remS}s` : `${m}m`
  const h = Math.floor(m / 60)
  const remM = m - h * 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

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

export function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString()
  } catch {
    return iso ?? ''
  }
}

export function formatDate(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString()
  } catch {
    return iso ?? ''
  }
}
