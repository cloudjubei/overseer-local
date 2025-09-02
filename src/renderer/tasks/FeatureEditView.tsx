import React from 'react'
import type { Feature, Task } from '../../../packages/factory-ts/src/types'
import { FeatureForm } from '../components/tasks/FeatureForm'

export function FeatureEditView({ task, feature, onSave }: { task: Task; feature: Feature; onSave: (data: Partial<Feature>) => void }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Edit Feature [{feature.id}]</h2>
      <FeatureForm initial={feature} onSubmit={onSave} />
    </div>
  )
}
