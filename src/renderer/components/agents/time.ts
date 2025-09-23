export function formatHmsCompact(ms?: number): string {
  if (ms == null || !isFinite(ms) || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad2 = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) return `${hours}:${pad2(minutes)}:${pad2(seconds)}h`
  if (minutes > 0) return `${minutes}:${pad2(seconds)}min`
  return `${seconds}s`
}
