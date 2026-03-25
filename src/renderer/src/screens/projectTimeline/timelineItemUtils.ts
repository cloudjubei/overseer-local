import React from 'react'
import type { Feature, Story } from 'thefactory-tools'
import type { Entity } from 'thefactory-db'
import type { RowDefinition, RowItem, TimelineLabel } from './ProjectTimelineTypes'

export const ENTITY_TYPE = 'TimelineLabel'

export function normalizeLabels(arr: Entity[]): TimelineLabel[] {
  return (arr || []).map((l) => ({ ...l, content: l.content as any })) as TimelineLabel[]
}

export function mapFeatureToTimelineLabel(projectId: string, feature: Feature): TimelineLabel {
  return {
    id: feature.id,
    projectId,
    type: ENTITY_TYPE,
    content: {
      timestamp: feature.completedAt ?? new Date().toISOString(),
      label: feature.title,
      description: (feature as any).description,
      featureId: feature.id,
    },
    createdAt: (feature as any).createdAt,
    updatedAt: (feature as any).updatedAt,
    metadata: feature as any,
    shouldEmbed: false,
  }
}

export function getStoryCompletedAt(story: Story): string | null {
  const anyStory: any = story as any
  if (anyStory?.completedAt) return anyStory.completedAt as string

  const times = (story.features || [])
    .map((f: any) => f?.completedAt)
    .filter((ts: any): ts is string => !!ts)

  if (!times.length) return null
  return times.reduce((max, ts) => (new Date(ts) > new Date(max) ? ts : max), times[0])
}

export function mapStoryToTimelineLabel(projectId: string, story: Story): TimelineLabel | null {
  const ts = getStoryCompletedAt(story)
  if (!ts) return null
  return {
    id: `story-${(story as any).id}`,
    projectId,
    type: ENTITY_TYPE,
    content: {
      timestamp: ts,
      label: (story as any).title,
      description: (story as any)?.description,
    },
    createdAt: (story as any)?.createdAt,
    updatedAt: (story as any)?.updatedAt,
    metadata: story as any,
    shouldEmbed: false,
  }
}

function hashToHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  h = Math.abs(h)
  return h % 360
}

export function storyColorStyles(storyId: string | undefined): React.CSSProperties {
  const base = storyId || 'default'
  const hue = hashToHue(base)
  const bg = `hsl(${hue}, 85%, 92%)`
  const border = `hsl(${hue}, 60%, 70%)`
  const text = `hsl(${hue}, 35%, 24%)`
  return { backgroundColor: bg, borderColor: border, color: text }
}

export function buildLabelRows(labels: TimelineLabel[], activeProjectId: string | undefined) {
  const groups = new Map<
    string,
    {
      key: string
      title: string
      items: RowItem[]
      rowScope: 'project' | '__global__'
    }
  >()

  for (const l of labels) {
    const title = l.content.label
    const k = title
    if (!groups.has(k)) groups.set(k, { key: k, title: k, items: [], rowScope: 'project' })
    const scopeOfItem: 'project' | '__global__' = l.projectId === activeProjectId ? 'project' : '__global__'
    const grp = groups.get(k)!
    grp.items.push({
      id: l.id,
      title,
      timestamp: l.content.timestamp,
      scope: scopeOfItem,
      kind: 'label',
      projectId: l.projectId,
    })
    if (scopeOfItem === '__global__') grp.rowScope = '__global__'
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.rowScope !== b.rowScope) return a.rowScope === '__global__' ? -1 : 1
    return a.title.localeCompare(b.title)
  })
}

export function buildAllProjectsRows({
  projects,
  displayedFeatures,
  displayedStories,
}: {
  projects: { id: string; title?: string }[]
  displayedFeatures: any[]
  displayedStories: any[]
}): RowDefinition[] {
  const byProject = new Map<
    string,
    { projectId: string; projectTitle: string; features: RowItem[]; stories: RowItem[] }
  >()

  for (const p of projects) {
    byProject.set(p.id, {
      projectId: p.id,
      projectTitle: p.title || p.id,
      features: [],
      stories: [],
    })
  }

  for (const f of displayedFeatures) {
    const pid = f.storyProjectId
    if (!pid) continue
    if (!byProject.has(pid)) {
      byProject.set(pid, { projectId: pid, projectTitle: pid, features: [], stories: [] })
    }
    byProject.get(pid)!.features.push({
      id: f.id,
      title: f.title,
      timestamp: f.completedAt ?? new Date().toISOString(),
      kind: 'feature',
      storyId: f.storyId,
      projectId: pid,
    })
  }

  for (const s of displayedStories) {
    const ts = getStoryCompletedAt(s)
    if (!ts) continue
    const pid = (s as any).projectId
    if (!pid) continue
    if (!byProject.has(pid)) {
      byProject.set(pid, { projectId: pid, projectTitle: pid, features: [], stories: [] })
    }
    byProject.get(pid)!.stories.push({
      id: (s as any).id,
      title: (s as any).title,
      timestamp: ts,
      kind: 'story',
      projectId: pid,
    })
  }

  const ordered = Array.from(byProject.values()).sort((a, b) => a.projectTitle.localeCompare(b.projectTitle))
  const out: RowDefinition[] = []

  for (const p of ordered) {
    out.push({
      key: `${p.projectId}-features`,
      title: 'Features',
      items: p.features,
      projectId: p.projectId,
      projectTitle: p.projectTitle,
    })
    out.push({
      key: `${p.projectId}-stories`,
      title: 'Stories',
      items: p.stories,
      projectId: p.projectId,
      projectTitle: p.projectTitle,
    })
  }

  return out
}
