import React from 'react'
import { FeatureCardRaw } from '@renderer/components/stories/FeatureCard'
import { StoryCardRaw } from '@renderer/components/stories/StoryCard'
import type { Project } from 'thefactory-tools'
import type { HoverInfo } from './ProjectTimelineTypes'

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

  // Prefer below, then above, then to the side.
  // Clamp inside viewport with a small margin.
  const margin = 8

  // Below
  if (belowTop + calloutH <= vh - margin) {
    return {
      top: clamp(belowTop, margin, vh - margin - calloutH),
      left: clamp(rect.left, margin, vw - margin - calloutW),
    }
  }

  // Above
  if (aboveTop >= margin) {
    return {
      top: clamp(aboveTop, margin, vh - margin - calloutH),
      left: clamp(rect.left, margin, vw - margin - calloutW),
    }
  }

  // Side (right preferred)
  if (sideLeft + calloutW <= vw - margin) {
    return {
      top: clamp(rect.top, margin, vh - margin - calloutH),
      left: clamp(sideLeft, margin, vw - margin - calloutW),
    }
  }

  // Side (left alt)
  return {
    top: clamp(rect.top, margin, vh - margin - calloutH),
    left: clamp(sideLeftAlt, margin, vw - margin - calloutW),
  }
}

export function TimelineHoverCard({
  hover,
  showAllProjects,
  storiesById,
  projects,
  activeProject,
}: {
  hover: HoverInfo
  showAllProjects: boolean
  storiesById: Record<string, any>
  projects: any[]
  activeProject: any
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

  const storyProjectFor = (story: any): Project | undefined => {
    if (!story) return undefined
    if (showAllProjects) return projects.find((p: any) => p.id === story.projectId)
    return activeProject as any
  }

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        top: pos.top,
        left: pos.left,
      }}
    >
      <div ref={calloutRef}>
        {hover.kind === 'story' ? (
          (() => {
            const story = storiesById[hover.storyId]
            const p = storyProjectFor(story)
            if (!p || !story) return null
            return <StoryCardRaw project={p as any} story={story} className="max-w-xs" />
          })()
        ) : hover.kind === 'feature' ? (
          (() => {
            const story = storiesById[hover.storyId]
            const f = story?.features?.find((x: any) => x.id === hover.featureId)
            const p = storyProjectFor(story)
            if (!p || !story || !f) return null
            return <FeatureCardRaw project={p as any} feature={f} story={story} className="max-w-xs" />
          })()
        ) : null}
      </div>
    </div>
  )
}
