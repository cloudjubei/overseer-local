import type { CSSProperties } from 'react'
import type { Entity, Feature, GetStoryResponse } from '@generated/backend'
import type { RowDefinition, RowItem, TimelineLabel } from './ProjectTimelineTypes'

export const ENTITY_TYPE = 'TimelineLabel'

export function normalizeLabels(arr: Entity[]): TimelineLabel[] {
  return (arr || []).map((l) => ({
    ...l,
    content: l.content as TimelineLabel['content'],
  })) as TimelineLabel[]
}

export function mapFeatureToTimelineLabel(
  projectId: string,
  feature: Feature & { description?: string; createdAt?: string; updatedAt?: string },
): TimelineLabel {
  return {
    id: feature.id,
    projectId,
    type: ENTITY_TYPE,
    shouldEmbed: false,
    content: {
      timestamp: feature.completedAt ?? new Date().toISOString(),
      label: feature.title,
      description: feature.description,
      featureId: feature.id,
    },
    createdAt: feature.createdAt ?? new Date().toISOString(),
    updatedAt: feature.updatedAt ?? new Date().toISOString(),
    metadata: feature as unknown as { [key: string]: never },
  }
}

export function getStoryCompletedAt(story: GetStoryResponse): string | null {
  const anyStory = story as GetStoryResponse & { completedAt?: string }
  if (anyStory.completedAt) return anyStory.completedAt

  const times = (story.features || []).map((f) => f.completedAt).filter((ts): ts is string => !!ts)

  if (!times.length) return null
  return times.reduce((max, ts) => (new Date(ts) > new Date(max) ? ts : max), times[0])
}

export function mapStoryToTimelineLabel(
  projectId: string,
  story: GetStoryResponse,
): TimelineLabel | null {
  const ts = getStoryCompletedAt(story)
  if (!ts) return null
  return {
    id: `story-${story.id}`,
    projectId,
    type: ENTITY_TYPE,
    shouldEmbed: false,
    content: {
      timestamp: ts,
      label: story.title,
      description: story.description,
    },
    createdAt: story.createdAt ?? new Date().toISOString(),
    updatedAt: story.updatedAt ?? new Date().toISOString(),
    metadata: story as unknown as { [key: string]: never },
  }
}

function hashToHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  h = Math.abs(h)
  return h % 360
}

export function storyColorStyles(storyId: string | undefined): CSSProperties {
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
    const scopeOfItem: 'project' | '__global__' =
      l.projectId === activeProjectId ? 'project' : '__global__'
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

export type AllProjectsBuildInput = {
  projects: { id: string; title?: string }[]
  displayedFeatures: Array<
    Feature & { storyId?: string; storyProjectId?: string; completedAt?: string }
  >
  displayedStories: Array<GetStoryResponse & { projectId?: string }>
}

export function buildAllProjectsRows({
  projects,
  displayedFeatures,
  displayedStories,
}: AllProjectsBuildInput): RowDefinition[] {
  const byProject = new Map<
    string,
    { projectId: string; projectTitle: string; features: RowItem[]; stories: RowItem[] }
  >()

  const projectTitleById = new Map(projects.map((p) => [p.id, p.title || p.id]))

  const ensureProject = (pid: string) => {
    if (!byProject.has(pid)) {
      byProject.set(pid, {
        projectId: pid,
        projectTitle: projectTitleById.get(pid) || pid,
        features: [],
        stories: [],
      })
    }
    return byProject.get(pid)!
  }

  for (const p of projects) {
    ensureProject(p.id)
  }

  for (const s of displayedStories) {
    const ts = getStoryCompletedAt(s)
    const pid = s.projectId
    if (!pid) continue
    ensureProject(pid)
    if (!ts) continue
    byProject.get(pid)!.stories.push({
      id: s.id,
      title: s.title,
      timestamp: ts,
      kind: 'story',
      projectId: pid,
    })
  }

  for (const f of displayedFeatures) {
    const pid = f.storyProjectId
    if (!pid) continue
    ensureProject(pid)
    byProject.get(pid)!.features.push({
      id: f.id,
      title: f.title,
      timestamp: f.completedAt ?? new Date().toISOString(),
      kind: 'feature',
      storyId: f.storyId,
      projectId: pid,
    })
  }

  const ordered = Array.from(byProject.values()).sort((a, b) =>
    a.projectTitle.localeCompare(b.projectTitle),
  )
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
