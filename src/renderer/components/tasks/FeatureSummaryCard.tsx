import React from 'react'
import type { Feature } from '../../../../packages/factory-ts/src/types'

export function FeatureSummaryCard({ feature, onClick }: { feature: Feature; onClick?: () => void }) {
  return (
    <div className="card bg-base-100 shadow cursor-pointer hover:shadow-lg" onClick={onClick}>
      <div className="card-body">
        <h3 className="card-title">[{feature.id}] {feature.title}</h3>
        <p className="text-sm opacity-70">{feature.description}</p>
      </div>
    </div>
  )
}
