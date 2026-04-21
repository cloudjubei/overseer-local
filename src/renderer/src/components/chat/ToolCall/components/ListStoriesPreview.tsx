import React from 'react'
import type { Story } from 'thefactory-tools'
import DependencyBullet from '@renderer/components/stories/DependencyBullet'
import { extract } from '../utils'

export function coerceStoriesList(raw: any): Story[] {
  const candidate =
    extract(raw, ['stories']) ||
    extract(raw, ['items']) ||
    extract(raw, ['results']) ||
    extract(raw, ['data.stories']) ||
    raw

  if (!Array.isArray(candidate)) return []

  return candidate.filter(
    (item): item is Story =>
      !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string',
  )
}

export default function ListStoriesPreview({ stories }: { stories: Story[] }) {
  if (stories.length === 0) {
    return <div className="text-[11px] text-[var(--text-secondary)]">No stories</div>
  }

  return (
    <div className="grid grid-cols-4 gap-2 items-start">
      {stories.map((story) => (
        <div key={story.id} className="min-w-0">
          <DependencyBullet dependency={story.id} />
        </div>
      ))}
    </div>
  )
}
