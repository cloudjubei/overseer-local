import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Feature, Story } from 'thefactory-tools'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject, useProjectContext } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import type { Entity, EntityInput } from 'thefactory-db'
import { StoryCardRaw } from '../components/stories/StoryCard'
import { FeatureCardRaw } from '../components/stories/FeatureCard'
import { useNavigator } from '../navigation/Navigator'
import { Switch } from '../components/ui/Switch'

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeek(d: Date) {
  // ISO week start (Monday)
  const x = startOfDay(d)
  const day = x.getDay() // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7 // 0 for Monday
  x.setDate(x.getDate() - diff)
  return x
}
function startOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function addWeeks(d: Date, n: number) {
  return addDays(d, n * 7)
}
function addMonths(d: Date, n: number) {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}
function diffInDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
function diffInWeeks(a: Date, b: Date) {
  const days = diffInDays(startOfWeek(a), startOfWeek(b))
  return Math.floor(days / 7)
}
function diffInMonths(a: Date, b: Date) {
  const sa = startOfMonth(a)
  const sb = startOfMonth(b)
  return (sb.getFullYear() - sa.getFullYear()) * 12 + (sb.getMonth() - sa.getMonth())
}

function isoWeekNumber(date: Date): number {
  // ISO week number (1-53)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

const DEFAULT_WINDOW_DAYS = 30
const LEFT_COL_WIDTH = '16rem'
const PROJECT_COL_WIDTH = '14rem'

const ROW_HEIGHT_PX = 144
const CELL_PADDING_PX = 8

type Zoom = 'day' | 'week' | 'month'

type Unit = {
  key: string
  start: Date
  labelTop: string
  labelBottom?: string
  groupLabel: string
}

interface TimestampContent {
  timestamp: string
  label: string
  description?: string
  featureId?: string
}
interface TimelineLabel extends Entity {
  content: TimestampContent
}
const ENTITY_TYPE = 'TimelineLabel'

function normalizeLabels(arr: Entity[]): TimelineLabel[] {
  return (arr || []).map((l) => ({ ...l, content: l.content as TimestampContent }))
}
function mapFeatureToTimelineLabel(projectId: string, feature: Feature): TimelineLabel {
  return {
    id: feature.id,
    projectId,
    type: ENTITY_TYPE,
    content: {
      timestamp: feature.completedAt ?? new Date().toISOString(),
      label: feature.title,
      description: feature.description,
      featureId: feature.id,
    },
    createdAt: feature.createdAt,
    updatedAt: feature.updatedAt,
    metadata: feature,
    shouldEmbed: false,
  }
}

function getStoryCompletedAt(story: Story): string | null {
  const anyStory: any = story as any
  if (anyStory?.completedAt) return anyStory.completedAt as string
  // Fallback: latest completed feature timestamp
  const times = (story.features || [])
    .map((f: any) => f?.completedAt)
    .filter((ts: any): ts is string => !!ts)
  if (!times.length) return null
  return times.reduce((max, ts) => (new Date(ts) > new Date(max) ? ts : max), times[0])
}

function mapStoryToTimelineLabel(projectId: string, story: Story): TimelineLabel | null {
  const ts = getStoryCompletedAt(story)
  if (!ts) return null
  return {
    id: `story-${story.id}`,
    projectId,
    type: ENTITY_TYPE,
    content: {
      timestamp: ts,
      label: story.title,
      description: (story as any)?.description,
    },
    createdAt: (story as any)?.createdAt,
    updatedAt: (story as any)?.updatedAt,
    metadata: story,
    shouldEmbed: false,
  }
}

function tsToInput(ts: string) {
  // Expect ISO string; keep yyyy-MM-ddTHH:mm
  try {
    return new Date(ts).toISOString().slice(0, 16)
  } catch {
    return ts.slice(0, 16)
  }
}

// Helper for consistent color-coding by story
function hashToHue(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  h = Math.abs(h)
  return h % 360
}
function storyColorStyles(storyId: string | undefined): React.CSSProperties {
  const base = storyId || 'default'
  const hue = hashToHue(base)
  const bg = `hsl(${hue}, 85%, 92%)`
  const border = `hsl(${hue}, 60%, 70%)`
  const text = `hsl(${hue}, 35%, 24%)`
  return { backgroundColor: bg, borderColor: border, color: text }
}

function getUnitIndex(zoom: Zoom, startAligned: Date, unitCount: number, ts: string): number {
  const d = new Date(ts)
  if (zoom === 'day') return clamp(diffInDays(startAligned, d), 0, unitCount - 1)
  if (zoom === 'week') return clamp(diffInWeeks(startAligned, d), 0, unitCount - 1)
  return clamp(diffInMonths(startAligned, d), 0, unitCount - 1)
}

// Row item type used internally for rendering
interface RowItem {
  id: string
  title: string
  timestamp: string
  kind: 'feature' | 'story' | 'label'
  storyId?: string // for feature coloring
  scope?: 'project' | '__global__' // for label coloring
  projectId?: string // for all-projects display
}

type RowDefinition = {
  key: string
  title: string
  items: RowItem[]
  projectId?: string
  projectTitle?: string
}

// Hover callout state
type HoverInfo =
  | null
  | {
      kind: 'story'
      storyId: string
      rect: DOMRect
    }
  | {
      kind: 'feature'
      storyId: string
      featureId: string
      rect: DOMRect
    }

function BucketedRow({
  row,
  units,
  unitCount,
  startAligned,
  zoom,
  labels,
  openEdit,
  onHover,
  onLeave,
  onClickStory,
  onClickFeature,
  stickyColumnCount,
}: {
  row: RowDefinition
  units: Unit[]
  unitCount: number
  startAligned: Date
  zoom: Zoom
  labels: TimelineLabel[]
  openEdit: (l: TimelineLabel) => void
  onHover: (info: HoverInfo) => void
  onLeave: () => void
  onClickStory: (storyId: string) => void
  onClickFeature: (storyId: string, featureId: string) => void
  stickyColumnCount: number
}) {
  const buckets = useMemo(() => {
    const byIdx: RowItem[][] = Array.from({ length: unitCount }, () => [])
    for (const item of row.items) {
      const idx = getUnitIndex(zoom, startAligned, unitCount, item.timestamp)
      byIdx[idx].push(item)
    }
    return byIdx
  }, [row.items, zoom, startAligned, unitCount])

  return (
    <>
      {/* Background grid lines */}
      <div className="absolute inset-0 flex pointer-events-none">
        {units.map((u, i) => {
          const isCurrentDay = zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
          return (
            <div
              key={i}
              className={`flex-none h-full border-subtle ${isCurrentDay ? 'bg-accent-primary/[0.03]' : ''}`}
              style={{
                width: `calc(100% / ${unitCount})`,
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Per-cell scrollable buckets */}
      <div className="relative w-full h-full flex">
        {buckets.map((items, i) => {
          const isCurrentDay = zoom === 'day' && diffInDays(units[i].start, startOfDay(new Date())) === 0
          return (
            <div
              key={i}
              data-current-day={isCurrentDay ? 'true' : 'false'}
              className="flex-none h-full border-subtle overflow-auto"
              style={{
                width: `calc(100% / ${unitCount})`,
                borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                padding: CELL_PADDING_PX,
              }}
            >
              <div className="flex flex-col gap-1">
                {items.map((item) => {
                  const isGlobal = item.scope === '__global__'

                  if (item.kind === 'label') {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="w-full flex items-center gap-2 text-left"
                        onClick={() => {
                          const l = labels.find((x) => x.id === item.id)
                          if (l) openEdit(l)
                        }}
                        title="Click to edit"
                      >
                        <span
                          className={`shrink-0 w-2.5 h-2.5 rotate-45 border ${isGlobal ? 'bg-purple-200 border-purple-500' : 'bg-emerald-200 border-emerald-500'}`}
                        />
                        <span className="text-[11px] text-muted truncate">{item.title}</span>
                      </button>
                    )
                  }

                  const style = storyColorStyles(item.storyId)
                  const clickable = item.kind === 'story' ? () => onClickStory(item.id) : () => onClickFeature(item.storyId!, item.id)

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full max-w-full text-left"
                      onClick={clickable}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        if (item.kind === 'story') {
                          onHover({ kind: 'story', storyId: item.id, rect })
                        } else {
                          onHover({ kind: 'feature', storyId: item.storyId!, featureId: item.id, rect })
                        }
                      }}
                      onMouseLeave={onLeave}
                      title={item.title}
                    >
                      <div
                        className="px-2 py-1 rounded text-[11px] font-medium border shadow-sm truncate"
                        style={{
                          ...style,
                          maxWidth: '100%',
                        }}
                      >
                        {item.title}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function ProjectTimelineView() {
  const { projectId, project } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const [labels, setLabels] = useState<TimelineLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add-label form state
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState<string>('')
  const [newDescription, setNewDescription] = useState<string>('')
  const [newTimestamp, setNewTimestamp] = useState<string>(() => new Date().toISOString().slice(0, 16)) // yyyy-MM-ddTHH:mm
  const [scope, setScope] = useState<'project' | '__global__'>('project')

  // Edit-label popup state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editTimestamp, setEditTimestamp] = useState<string>('')
  const [editScope, setEditScope] = useState<'project' | '__global__'>('project')
  const [savingEdit, setSavingEdit] = useState(false)

  // Zoom state
  const [zoom, setZoom] = useState<Zoom>('day')

  // Hover state for callout
  const [hover, setHover] = useState<HoverInfo>(null)

  const [showAllProjects, setShowAllProjects] = useState(false)

  // Auto-scroll bookkeeping
  const hasInitialAutoScrolledRef = useRef(false)
  const prevZoomRef = useRef<Zoom>('day')

  const prevProjectIdRef = useRef(projectId)
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      hasInitialAutoScrolledRef.current = false
      setShowAllProjects(false)
      prevProjectIdRef.current = projectId
    }
  }, [projectId])

  const displayedStories = useMemo(() => {
    if (showAllProjects) return Object.values(storiesById)
    if (!project) return []
    return project.storyIds.map((id) => storiesById[id]).filter(Boolean)
  }, [storiesById, project, showAllProjects])

  const displayedFeatures = useMemo(() => {
    return displayedStories
      .flatMap((t) =>
        (t.features || []).map((f: Feature) => ({
          ...f,
          storyProjectId: (t as any).projectId ?? projectId,
          storyId: (t as any).id,
        })),
      )
      .filter((f) => !!f.completedAt)
  }, [displayedStories, projectId])

  // Fetch timeline labels
  useEffect(() => {
    if (!projectId && !showAllProjects) {
      setError('Project ID is missing.')
      setLoading(false)
      return
    }

    const fetchTimelineData = async () => {
      setLoading(true)
      setError(null)
      try {
        let fetchedLabels: Entity[] = []
        if (showAllProjects) {
          fetchedLabels = await dbService.matchEntities(undefined, { types: [ENTITY_TYPE] })
        } else {
          const projectLabels = projectId
            ? await dbService.matchEntities(undefined, {
                projectIds: [projectId],
                types: [ENTITY_TYPE],
              })
            : []
          const globalLabels = await dbService.matchEntities(undefined, {
            projectIds: ['__global__'],
            types: [ENTITY_TYPE],
          })
          fetchedLabels = [...projectLabels, ...globalLabels]
        }
        setLabels(normalizeLabels(fetchedLabels))
      } catch (err: any) {
        console.error('Failed to fetch timeline data:', err)
        setError(err?.message || 'An unknown error occurred while fetching timeline data.')
      } finally {
        setLoading(false)
      }
    }

    fetchTimelineData()
  }, [projectId, showAllProjects])

  const timelineItems = useMemo(() => {
    const fs = displayedFeatures.map((f: any) => mapFeatureToTimelineLabel(f.storyProjectId, f))
    const ts = displayedStories
      .map((t: any) => mapStoryToTimelineLabel(t.projectId ?? projectId ?? 'noproj', t))
      .filter((x): x is TimelineLabel => !!x)

    return [...fs, ...ts, ...labels].sort(
      (a, b) => new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime(),
    )
  }, [displayedFeatures, displayedStories, labels, projectId])

  // Determine raw min/max
  const { rawStartDate, rawEndDate } = useMemo(() => {
    const now = new Date()
    const defaultStart = addDays(now, -DEFAULT_WINDOW_DAYS)
    const defaultEnd = addDays(now, DEFAULT_WINDOW_DAYS)

    if (timelineItems.length === 0) {
      return { rawStartDate: startOfDay(defaultStart), rawEndDate: startOfDay(defaultEnd) }
    }

    const min = startOfDay(
      timelineItems.reduce(
        (min, x: TimelineLabel) =>
          new Date(x.content.timestamp) < min ? new Date(x.content.timestamp) : min,
        new Date(timelineItems[0].content.timestamp),
      ),
    )
    const max = startOfDay(
      timelineItems.reduce(
        (max, x: any) =>
          new Date(x.content.timestamp) > max ? new Date(x.content.timestamp) : max,
        new Date(timelineItems[0].content.timestamp),
      ),
    )

    return { rawStartDate: min, rawEndDate: max }
  }, [timelineItems])

  // Build units based on zoom (columns)
  const { units, unitCount, startAligned } = useMemo(() => {
    let start: Date
    let end: Date
    const arr: Unit[] = []

    if (zoom === 'day') {
      const paddedStart = addDays(rawStartDate, -2)
      const paddedEnd = addDays(rawEndDate, 2)
      start = startOfDay(paddedStart)
      end = startOfDay(paddedEnd)
      const count = Math.max(1, diffInDays(start, end) + 1)
      for (let i = 0; i < count; i++) {
        const d = addDays(start, i)
        arr.push({
          key: `d-${d.toISOString().slice(0, 10)}`,
          start: d,
          labelTop: d.toLocaleDateString(undefined, { day: 'numeric' }),
          labelBottom: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
          groupLabel: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        })
      }
      return { units: arr, unitCount: arr.length, startAligned: start }
    }

    if (zoom === 'week') {
      const paddedStart = addWeeks(startOfWeek(rawStartDate), -1)
      const paddedEnd = addWeeks(startOfWeek(rawEndDate), 1)
      start = startOfWeek(paddedStart)
      end = startOfWeek(paddedEnd)
      const count = Math.max(1, diffInWeeks(start, end) + 1)
      for (let i = 0; i < count; i++) {
        const d = addWeeks(start, i)
        const wk = isoWeekNumber(d)
        arr.push({
          key: `w-${d.toISOString().slice(0, 10)}`,
          start: d,
          labelTop: `Wk ${wk}`,
          labelBottom: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          groupLabel: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        })
      }
      return { units: arr, unitCount: arr.length, startAligned: start }
    }

    // month
    const paddedStart = addMonths(startOfMonth(rawStartDate), -1)
    const paddedEnd = addMonths(startOfMonth(rawEndDate), 1)
    start = startOfMonth(paddedStart)
    end = startOfMonth(paddedEnd)
    const count = Math.max(1, diffInMonths(start, end) + 1)
    for (let i = 0; i < count; i++) {
      const d = addMonths(start, i)
      arr.push({
        key: `m-${d.getFullYear()}-${d.getMonth()}`,
        start: d,
        labelTop: d.toLocaleDateString(undefined, { month: 'short' }),
        labelBottom: String(d.getFullYear()),
        groupLabel: String(d.getFullYear()),
      })
    }
    return { units: arr, unitCount: arr.length, startAligned: start }
  }, [rawStartDate, rawEndDate, zoom])

  // Header groups based on units
  const headerGroups = useMemo(() => {
    const groups: { label: string; startIdx: number; len: number }[] = []
    let current = ''
    let startIdx = 0
    for (let i = 0; i < units.length; i++) {
      const g = zoom === 'month' ? String(units[i].start.getFullYear()) : units[i].groupLabel
      if (i === 0) {
        current = g
        startIdx = 0
      } else if (g !== current) {
        groups.push({ label: current, startIdx, len: i - startIdx })
        current = g
        startIdx = i
      }
    }
    if (units.length > 0) groups.push({ label: current, startIdx, len: units.length - startIdx })
    return groups
  }, [units, zoom])

  // Grid column sizing based on zoom
  const cellMinWidth = useMemo(() => {
    switch (zoom) {
      case 'month':
        return 130
      case 'week':
        return 160
      default:
        return 200
    }
  }, [zoom])

  const stickyColumnCount = showAllProjects ? 2 : 1
  const gridTemplate = useMemo(() => {
    const sticky = showAllProjects ? `${PROJECT_COL_WIDTH} ${LEFT_COL_WIDTH}` : `${LEFT_COL_WIDTH}`
    return `${sticky} repeat(${unitCount}, minmax(${cellMinWidth}px, 1fr))`
  }, [unitCount, cellMinWidth, showAllProjects])

  const featureRowSingleProject = useMemo<RowDefinition>(() => {
    const items: RowItem[] = displayedFeatures.map((f: any) => ({
      id: f.id,
      title: f.title,
      timestamp: f.completedAt ?? new Date().toISOString(),
      kind: 'feature',
      storyId: f.storyId,
      projectId: f.storyProjectId,
    }))
    return { key: 'features', title: 'Features', items }
  }, [displayedFeatures])

  const storyRowSingleProject = useMemo<RowDefinition>(() => {
    const items = displayedStories
      .map((t: any) => {
        const ts = getStoryCompletedAt(t)
        if (!ts) return null
        return {
          id: t.id,
          title: t.title,
          timestamp: ts,
          kind: 'story' as const,
          projectId: t.projectId,
        } as RowItem
      })
      .filter((x): x is RowItem => !!x)

    return { key: 'stories', title: 'Stories', items }
  }, [displayedStories])

  const labelRows = useMemo(() => {
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
      const scopeOfItem: 'project' | '__global__' = l.projectId === projectId ? 'project' : '__global__'
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
  }, [labels, projectId])

  const rows = useMemo<RowDefinition[]>(() => {
    if (!showAllProjects) {
      return [featureRowSingleProject, storyRowSingleProject, ...labelRows]
    }

    // All-projects: stack Feature/Story per project
    const byProject = new Map<string, { projectId: string; projectTitle: string; features: RowItem[]; stories: RowItem[] }>()
    for (const p of projects) {
      byProject.set(p.id, { projectId: p.id, projectTitle: p.title || p.id, features: [], stories: [] })
    }

    // Populate from displayedStories / displayedFeatures (already across all projects)
    for (const f of displayedFeatures as any[]) {
      const pid = f.storyProjectId ?? '__unknown__'
      if (!byProject.has(pid)) byProject.set(pid, { projectId: pid, projectTitle: pid, features: [], stories: [] })
      byProject.get(pid)!.features.push({
        id: f.id,
        title: f.title,
        timestamp: f.completedAt ?? new Date().toISOString(),
        kind: 'feature',
        storyId: f.storyId,
        projectId: pid,
      })
    }

    for (const s of displayedStories as any[]) {
      const ts = getStoryCompletedAt(s)
      if (!ts) continue
      const pid = s.projectId ?? '__unknown__'
      if (!byProject.has(pid)) byProject.set(pid, { projectId: pid, projectTitle: pid, features: [], stories: [] })
      byProject.get(pid)!.stories.push({
        id: s.id,
        title: s.title,
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

    // Append label rows at bottom (keep behavior consistent)
    return [...out, ...labelRows]
  }, [
    showAllProjects,
    featureRowSingleProject,
    storyRowSingleProject,
    labelRows,
    projects,
    displayedFeatures,
    displayedStories,
  ])

  // Refs for scrolling logic
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerScrollRef = useRef<HTMLDivElement>(null)

  // Sync horizontal scroll between body and header scroller
  const handleScroll = () => {
    if (scrollContainerRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollContainerRef.current.scrollLeft
    }
  }

  // Auto-scroll to END (rightmost) on initial load or zoom change
  useEffect(() => {
    if (loading || units.length === 0) return

    if (!hasInitialAutoScrolledRef.current || prevZoomRef.current !== zoom) {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current
        if (!container) return
        container.scrollTo({ left: container.scrollWidth, behavior: 'auto' })
        hasInitialAutoScrolledRef.current = true
        prevZoomRef.current = zoom
      })
    }
  }, [loading, units.length, zoom])

  // Interactions
  const onAddLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    try {
      setLoading(true)
      const input: EntityInput = {
        projectId: scope === '__global__' ? '__global__' : (projectId ?? 'noproj'),
        type: ENTITY_TYPE,
        content: {
          timestamp: new Date(newTimestamp).toISOString(),
          label: newLabel.trim(),
          description: newDescription.trim() || undefined,
        },
      }
      const created = await dbService.addEntity(input)
      setLabels((prev) => [...prev, normalizeLabels([created])[0]])
      setIsAdding(false)
      setNewLabel('')
      setNewDescription('')
    } catch (err: any) {
      alert(`Failed to create label: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (l: TimelineLabel) => {
    setEditingId(l.id)
    setEditLabel(l.content.label)
    setEditDescription(l.content.description || '')
    setEditTimestamp(tsToInput(l.content.timestamp))
    setEditScope(l.projectId === '__global__' ? '__global__' : 'project')
  }

  const closeEdit = () => {
    setEditingId(null)
    setEditLabel('')
    setEditDescription('')
    setEditTimestamp('')
  }

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId || !editLabel.trim()) return
    setSavingEdit(true)
    try {
      const pid = editScope === '__global__' ? '__global__' : (projectId ?? 'noproj')
      const targetLabels = await dbService.matchEntities(undefined, { ids: [editingId] })
      if (!targetLabels.length) throw new Error('Label not found')
      const target = targetLabels[0]

      const updated = await dbService.updateEntity(editingId, {
        projectId: pid,
        content: {
          ...(target.content as Record<string, any>),
          timestamp: new Date(editTimestamp).toISOString(),
          label: editLabel.trim(),
          description: editDescription.trim() || undefined,
        },
      })
      setLabels((prev) => prev.map((x) => (x.id === editingId ? normalizeLabels([updated!])[0] : x)))
      closeEdit()
    } catch (err: any) {
      alert(`Failed to save edit: ${err?.message || err}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const onDeleteEdit = async () => {
    if (!editingId) return
    if (!window.confirm('Are you sure you want to delete this timeline label?')) return
    setSavingEdit(true)
    try {
      await dbService.deleteEntity(editingId)
      setLabels((prev) => prev.filter((x) => x.id !== editingId))
      closeEdit()
    } catch (err: any) {
      alert(`Failed to delete: ${err?.message || err}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const onClickStory = (storyId: string) => {
    navigateStoryDetails(storyId.replace('story-', ''))
  }

  const onClickFeature = (storyId: string, _featureId: string) => {
    // Keep behavior consistent with previous: click navigates to story details
    navigateStoryDetails(storyId)
  }


  return (
    <div className="flex flex-col h-full bg-base text-primary overflow-hidden">
      {/* Top Toolbar */}
      <div className="shrink-0 border-b border-default p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-raised">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Timeline</h2>
          <div className="flex items-center bg-base border border-subtle rounded-md p-1">
            <button
              onClick={() => setZoom('day')}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${zoom === 'day' ? 'bg-accent-primary text-inverted shadow-sm' : 'text-muted hover:text-primary hover:bg-raised'}`}
            >
              Day
            </button>
            <button
              onClick={() => setZoom('week')}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${zoom === 'week' ? 'bg-accent-primary text-inverted shadow-sm' : 'text-muted hover:text-primary hover:bg-raised'}`}
            >
              Week
            </button>
            <button
              onClick={() => setZoom('month')}
              className={`px-3 py-1 text-xs font-medium rounded-sm ${zoom === 'month' ? 'bg-accent-primary text-inverted shadow-sm' : 'text-muted hover:text-primary hover:bg-raised'}`}
            >
              Month
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="allProjectsSwitch" className="text-sm font-medium cursor-pointer">
              All projects
            </label>
            <Switch key="allProjectsSwitch" checked={showAllProjects} onCheckedChange={setShowAllProjects} />
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 text-sm font-medium border border-default rounded bg-base hover:bg-raised shadow-sm"
          >
            {isAdding ? 'Cancel' : 'Add label…'}
          </button>
        </div>
      </div>

      {isAdding && (
        <form onSubmit={onAddLabel} className="shrink-0 border-b border-default bg-raised p-4 flex flex-col gap-3">
          <div className="text-sm font-medium text-primary">New timeline label</div>
          <div className="grid gap-2 sm:grid-cols-5 items-end">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted">Row label</label>
              <input
                className="h-9 rounded border border-default bg-base px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Milestone A"
                required
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-xs text-muted">Description (optional)</label>
              <input
                className="h-9 rounded border border-default bg-base px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short note"
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted">When</label>
              <input
                type="datetime-local"
                className="h-9 rounded border border-default bg-base px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                value={newTimestamp}
                onChange={(e) => setNewTimestamp(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-muted">Scope</label>
              <select
                className="h-9 rounded border border-default bg-base px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
              >
                <option value="project">This project</option>
                <option value="__global__">All projects (global)</option>
              </select>
            </div>
            <div className="sm:col-span-1">
              <button
                type="submit"
                className="h-9 w-full rounded bg-accent-primary text-inverted hover:bg-accent-hover text-sm font-medium focus:outline-none focus-visible:ring-2 ring-offset-1"
                disabled={loading}
              >
                Save
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <div className="shrink-0 p-4 m-4 border border-red-200 bg-red-50 text-red-600 rounded">{error}</div>}

      <div className="flex-1 min-h-0 relative flex flex-col bg-base overflow-hidden">
        {/* Sticky Header */}
        <div className="shrink-0 w-full overflow-hidden border-b border-default bg-raised">
          <div className="grid text-xs text-muted" style={{ gridTemplateColumns: gridTemplate }}>
            {showAllProjects && (
              <div className="sticky left-0 z-30 bg-raised border-r border-default h-[3.5rem]" />
            )}
            <div
              className={`${showAllProjects ? 'sticky z-20' : 'sticky left-0 z-20'} bg-raised border-r border-default h-[3.5rem]`}
              style={showAllProjects ? ({ left: PROJECT_COL_WIDTH } as any) : undefined}
            />

            {/* Scrollable header scroller for units only */}
            <div
              ref={headerScrollRef}
              className="col-start-2 relative h-[3.5rem] overflow-hidden"
              style={{ gridColumnEnd: -1, gridColumnStart: stickyColumnCount + 1 }}
            >
              {/* Grouping row */}
              <div className="absolute top-0 left-0 w-full flex h-6 border-b border-subtle">
                {headerGroups.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex-none px-2 py-1 font-semibold text-[11px] uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{
                      width: `calc(${g.len} * (100% / ${unitCount}))`,
                      borderLeft: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>

              {/* Individual unit columns */}
              <div className="absolute top-6 left-0 w-full flex h-8">
                {units.map((u, i) => {
                  const isCurrentDay = zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
                  return (
                    <div
                      key={u.key}
                      className={`flex-none flex flex-col items-center justify-center border-subtle ${isCurrentDay ? 'bg-accent-primary/10 text-accent-primary font-bold' : ''}`}
                      style={{
                        width: `calc(100% / ${unitCount})`,
                        borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      <div className="text-[11px] leading-tight">{u.labelTop}</div>
                      {u.labelBottom && <div className="text-[9px] opacity-75">{u.labelBottom}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 w-full overflow-auto relative">
          {loading && labels.length === 0 ? (
            <div className="p-4 text-sm text-muted">Loading timeline...</div>
          ) : (
            <div className="grid pb-12" style={{ gridTemplateColumns: gridTemplate }}>
              {rows.map((row, rIdx) => (
                <React.Fragment key={row.key}>
                  {showAllProjects && (
                    <div
                      className="sticky left-0 z-20 flex items-center bg-base border-r border-default border-b px-3"
                      style={{ gridRow: rIdx + 1, height: ROW_HEIGHT_PX, width: PROJECT_COL_WIDTH }}
                      title={row.projectTitle || ''}
                    >
                      <div className="text-sm font-medium text-primary truncate">{row.projectTitle || ''}</div>
                    </div>
                  )}

                  <div
                    className={`${showAllProjects ? 'sticky z-10' : 'sticky left-0 z-10'} flex items-center bg-base border-r border-default border-b px-3`}
                    style={{
                      gridRow: rIdx + 1,
                      height: ROW_HEIGHT_PX,
                      width: LEFT_COL_WIDTH,
                      ...(showAllProjects ? ({ left: PROJECT_COL_WIDTH } as any) : {}),
                    }}
                    title={row.title}
                  >
                    <div className="text-sm font-medium text-primary truncate">{row.title}</div>
                  </div>

                  <div
                    className="relative border-b border-subtle"
                    style={{
                      gridColumn: `${stickyColumnCount + 1} / -1`,
                      gridRow: rIdx + 1,
                      height: ROW_HEIGHT_PX,
                    }}
                  >
                    <BucketedRow
                      row={row}
                      units={units}
                      unitCount={unitCount}
                      startAligned={startAligned}
                      zoom={zoom}
                      labels={labels}
                      openEdit={openEdit}
                      onHover={setHover}
                      onLeave={() => setHover(null)}
                      onClickStory={onClickStory}
                      onClickFeature={onClickFeature}
                      stickyColumnCount={stickyColumnCount}
                    />
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover callout */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: Math.max(8, hover.rect.top + window.scrollY - 4),
            left: Math.min(window.scrollX + window.innerWidth - 320, hover.rect.left + window.scrollX + hover.rect.width + 8),
          }}
        >
          {hover.kind === 'story'
            ? (() => {
                const story = storiesById[hover.storyId]
                const storyProject = showAllProjects
                  ? projects.find((p) => p.id === (story as any)?.projectId)
                  : project
                if (!storyProject || !story) return null
                return <StoryCardRaw project={storyProject as any} story={story} className="max-w-xs" />
              })()
            : hover.kind === 'feature'
              ? (() => {
                  const story = storiesById[hover.storyId]
                  const f = story?.features.find((x) => x.id === hover.featureId)
                  const storyProject = showAllProjects
                    ? projects.find((p) => p.id === (story as any)?.projectId)
                    : project
                  if (!storyProject || !story || !f) return null
                  return <FeatureCardRaw project={storyProject as any} feature={f} story={story} className="max-w-xs" />
                })()
              : null}
        </div>
      )}

      {/* Edit popup modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={closeEdit} />
          <form
            onSubmit={onSaveEdit}
            className="relative z-10 w-[520px] max-w-[95vw] rounded-md border border-default bg-base shadow-lg p-4 space-y-3"
          >
            <div className="text-sm font-medium text-primary">Edit timeline label</div>
            <div className="grid gap-2 sm:grid-cols-5 items-end">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-muted">Row label</label>
                <input
                  className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g. Milestone A"
                  required
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-3">
                <label className="text-xs text-muted">Description (optional)</label>
                <input
                  className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Short note"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-muted">When</label>
                <input
                  type="datetime-local"
                  className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                  value={editTimestamp}
                  onChange={(e) => setEditTimestamp(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label className="text-xs text-muted">Scope</label>
                <select
                  className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
                  value={editScope}
                  onChange={(e) => setEditScope(e.target.value as any)}
                >
                  <option value="project">This project</option>
                  <option value="__global__">All projects (global)</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onDeleteEdit}
                  className="h-9 px-3 text-sm rounded border border-subtle bg-raised text-red-600 hover:bg-base"
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeEdit}
                className="px-3 py-1.5 text-sm rounded border border-subtle bg-raised hover:bg-base text-primary"
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 text-sm rounded bg-accent-primary text-inverted hover:bg-accent-hover focus:outline-none focus-visible:ring-2 ring-offset-1 disabled:opacity-60"
                disabled={savingEdit}
              >
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
