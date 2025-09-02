import React from 'react'
import type { Feature } from '../../../../packages/factory-ts/src/types'

export function DependencyBullet({ feature, id, onRemove }: { feature: Feature; id: string; onRemove: (id: string) => void }) {
  const checked = (feature.dependencies || []).includes(id)
  return (
    <div className="badge badge-outline cursor-pointer" onClick={() => onRemove(id)}>
      {checked ? '✓' : '•'} {id}
    </div>
  )
}
