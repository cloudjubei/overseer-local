import React from 'react'
import type { Feature } from '../../../../packages/factory-ts/src/types'

export function FeatureSummaryCallout({ feature }: { feature: Feature }) {
  return (
    <div className="alert">
      <span>Feature [{feature.id}] is {feature.status}</span>
    </div>
  )
}
