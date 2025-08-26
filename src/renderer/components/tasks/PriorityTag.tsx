import React from 'react'

export type Priority = 'P0' | 'P1' | 'P2' | 'P3' | 'None'

export function parsePriorityFromTitle(title?: string): Priority {
  const t = (title || '').toUpperCase()
  const m = t.match(/\bP([0-3])\b/) || t.match(/\[(P[0-3])\]/)
  if (m) {
    const p = m[1] || m[0]
    if (p === '0' || p === 'P0') return 'P0'
    if (p === '1' || p === 'P1') return 'P1'
    if (p === '2' || p === 'P2') return 'P2'
    if (p === '3' || p === 'P3') return 'P3'
  }
  return 'None'
}

export default function PriorityTag({ priority, className = '' }: { priority: Priority; className?: string }) {
  if (priority === 'None') return null
  const colorCls = (() => {
    switch (priority) {
      case 'P0': return 'priority--p0'
      case 'P1': return 'priority--p1'
      case 'P2': return 'priority--p2'
      case 'P3': return 'priority--p3'
      default: return ''
    }
  })()
  return <span className={`priority-tag ${colorCls} ${className}`}>{priority}</span>
}
