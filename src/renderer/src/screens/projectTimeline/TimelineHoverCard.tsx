import React from 'react'
import { FeatureCard, StoryCard, type StoryStatus } from 'thefactory-ui/web'
import type { Story } from 'thefactory-tools'
import type { HoverInfo } from './ProjectTimelineTypes'
import DependencyBullet from '@renderer/components/stories/DependencyBullet'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function computeCalloutPosition(rect: DOMRect, calloutW = 320, calloutH = 240, gap = 8) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const belowTop = rect.bottom + gap
  const aboveTop = rect.top - gap - calloutH
  const sideLeft = rect.right + gap
  const sideLeftAlt = rect.left - gap - calloutW
  const margin = 8

  // Prefer below, then above, then to the side.
  if (belowTop + calloutH <= vh - margin) {
    return {
      top: clamp(belowTop, margin, vh - margin - calloutH),
      left: clamp(rect.left, margin, vw - margin - calloutW),
    }
  }
  if (aboveTop >= margin) {
    return {
      top: clamp(aboveTop, margin, vh - margin - calloutH),
      left: clamp(rect.left, margin, vw - margin - calloutW),
    }
  }
  if (sideLeft + calloutW <= vw - margin) {
    return {
      top: clamp(rect.top, margin, vh - margin - calloutH),
      left: clamp(sideLeft, margin, vw - margin - calloutW),
    }
  }
  return {
    top: clamp(rect.top, margin, vh - margin - calloutH),
    left: clamp(sideLeftAlt, margin, vw - margin - calloutW),
  }
}

/**
 * Hover preview for a story or feature in the timeline grid. Uses the
 * shared `StoryCard` / `FeatureCard` primitives from `thefactory-ui` so the
 * web and desktop hover cards are byte-for-byte identical.
 */
export function TimelineHoverCard({
  hover,
  storiesById,
}: {
  hover: HoverInfo
  storiesById: Record<string, Story>
}) {
  const calloutRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 320, h: 240 })

  React.useLayoutEffect(() => {
    if (!hover) return
    const el = calloutRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width && r.height) setSize({ w: r.width, h: r.height })
  }, [hover])

  if (!hover) return null

  const pos = computeCalloutPosition(hover.rect, size.w, size.h)

  const renderBlocker = (dep: string) => (
    <DependencyBullet dependency={dep} interactive={false} disableHoverInfo />
  )

  const headerFor = (storyId: string, featureId?: string) => (
    <DependencyBullet
      dependency={featureId ? `${storyId}.${featureId}` : storyId}
      interactive={false}
      disableHoverInfo
    />
  )

  let body: React.ReactNode = null
  if (hover.kind === 'story') {
    const story = storiesById[hover.storyId]
    if (story) {
      body = (
        <StoryCard
          story={{
            id: story.id,
            title: story.title,
            description: (story as any).description,
            status: story.status as StoryStatus,
            blockers: story.blockers,
          }}
          headerLeft={headerFor(story.id)}
          renderBlocker={renderBlocker}
          className="max-w-xs"
        />
      )
    }
  } else if (hover.kind === 'feature') {
    const story = storiesById[hover.storyId]
    const feature = story?.features.find((x: any) => x.id === hover.featureId)
    if (story && feature) {
      body = (
        <FeatureCard
          feature={{
            id: feature.id,
            title: feature.title,
            description: (feature as any).description,
            status: feature.status as StoryStatus,
            blockers: feature.blockers,
          }}
          headerLeft={headerFor(story.id, feature.id)}
          renderBlocker={renderBlocker}
          className="max-w-xs"
        />
      )
    }
  }

  if (!body) return null

  return (
    <div className="fixed z-50 pointer-events-none" style={{ top: pos.top, left: pos.left }}>
      <div ref={calloutRef}>{body}</div>
    </div>
  )
}
