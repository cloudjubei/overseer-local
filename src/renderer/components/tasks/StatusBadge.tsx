import React from 'react'
import type { Status } from 'src/types/tasks'

// Map our compact Status codes to Monday-like semantic names
function mapStatusToSemantic(status: Status | string): { key: string; label: string } {
  switch (status) {
    case '+': return { key: 'done', label: 'Done' }
    case '~': return { key: 'working', label: 'In Progress' }
    case '-': return { key: 'queued', label: 'Pending' }
    case '?': return { key: 'stuck', label: 'Blocked' }
    case '=': return { key: 'onhold', label: 'Deferred' }
    default: return { key: 'queued', label: String(status || '') }
  }
}

export function StatusBadge({ status, variant = 'soft', className = '', title }: { status: Status | string; variant?: 'soft' | 'bold'; className?: string; title?: string }) {
  const { key, label } = mapStatusToSemantic(status)
  const cls = `badge badge--${variant} badge--${key} ${className}`
  return (
    <span className={cls} aria-label={`${label} status`} title={title || label}>
      {label}
    </span>
  )
}

export default StatusBadge
