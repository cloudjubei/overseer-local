import React from 'react'
import DependencyBullet from './DependencyBullet'

interface StoryAndFeatureCalloutProps {
  storyId?: string
  featureId?: string
}

export default function StoryAndFeatureCallout({
  storyId,
  featureId,
}: StoryAndFeatureCalloutProps) {
  const deps: string[] = []
  if (storyId) {
    deps.push(storyId)
  }
  if (storyId && featureId) {
    deps.push(`${storyId}.${featureId}`)
  }

  if (deps.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-1 min-w-[60px] min-h-[30px]">
      {deps.map((d) => (
        <DependencyBullet
          key={d}
          dependency={d}
          interactive
          notFoundDependencyDisplay={'*DELETED*'}
        />
      ))}
    </div>
  )
}
