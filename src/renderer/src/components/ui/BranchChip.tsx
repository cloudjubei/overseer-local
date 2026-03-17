import React from 'react'

/**
 * BranchChip — reusable inline badge for branch metadata.
 *
 * type:
 *   'local'   → neutral/empty badge   (local-only branch)
 *   'remote'  → blue/working badge    (remote tracking branch)
 *   'current' → green/done badge      (currently checked-out branch)
 *   'same'    → neutral badge         (tip SHA matches current)
 *   'updated' → amber/review badge    (has unpushed/new commits)
 *   'story'   → purple/queued badge   (feature branch tied to a story)
 *
 * size: 'sm' (default) | 'xs'
 */

export type BranchChipType = 'local' | 'remote' | 'current' | 'same' | 'updated' | 'story'

const TYPE_CLASS: Record<BranchChipType, string> = {
  local: 'badge--empty',
  remote: 'badge--working',
  current: 'badge--done',
  same: 'badge--empty',
  updated: 'badge--review',
  story: 'badge--queued',
}

const DEFAULT_LABEL: Record<BranchChipType, string> = {
  local: 'Local',
  remote: 'Remote',
  current: 'Current',
  same: 'Same',
  updated: 'Updated',
  story: 'Story',
}

export function BranchChip({
  type,
  label,
  size = 'sm',
  className = '',
}: {
  type: BranchChipType
  label?: string
  /** 'sm' = 10px text, 'xs' = 9px text (default: 'sm') */
  size?: 'sm' | 'xs'
  className?: string
}) {
  const sizeClass = size === 'xs'
    ? 'text-[9px] px-1.5 py-0.5'
    : 'text-[10px] px-1.5 py-0.5'

  return (
    <span
      className={`badge badge--soft ${TYPE_CLASS[type]} ${sizeClass} leading-none font-medium ${className}`}
    >
      {label ?? DEFAULT_LABEL[type]}
    </span>
  )
}
