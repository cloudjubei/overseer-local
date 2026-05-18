import { Zoom } from './ProjectTimelineTypes'

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function startOfWeek(d: Date) {
  // ISO week start (Monday)
  const x = startOfDay(d)
  const day = x.getDay() // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7 // 0 for Monday
  x.setDate(x.getDate() - diff)
  return x
}

export function startOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addWeeks(d: Date, n: number) {
  return addDays(d, n * 7)
}

export function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

export function diffInDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function diffInWeeks(a: Date, b: Date) {
  const days = diffInDays(startOfWeek(a), startOfWeek(b))
  return Math.floor(days / 7)
}

export function diffInMonths(a: Date, b: Date) {
  const sa = startOfMonth(a)
  const sb = startOfMonth(b)
  return (sb.getFullYear() - sa.getFullYear()) * 12 + (sb.getMonth() - sa.getMonth())
}

export function isoWeekNumber(date: Date): number {
  // ISO week number (1-53)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function getUnitIndex(zoom: Zoom, startAligned: Date, unitCount: number, ts: string): number {
  const d = new Date(ts)
  if (zoom === 'day') return clamp(diffInDays(startAligned, d), 0, unitCount - 1)
  if (zoom === 'week') return clamp(diffInWeeks(startAligned, d), 0, unitCount - 1)
  return clamp(diffInMonths(startAligned, d), 0, unitCount - 1)
}

export function tsToInput(ts: string) {
  // Expect ISO string; keep yyyy-MM-ddTHH:mm
  try {
    return new Date(ts).toISOString().slice(0, 16)
  } catch {
    return ts.slice(0, 16)
  }
}
