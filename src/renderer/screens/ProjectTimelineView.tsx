import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Feature, Story } from 'thefactory-tools'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import { Entity } from 'thefactory-db'
import { EntityInput } from 'thefactory-db/dist/types'
import StorySummaryCallout from '../components/stories/StorySummaryCallout'
import FeatureSummaryCallout from '../components/stories/FeatureSummaryCallout'
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

export default function ProjectTimelineView() {
  const { projectId, project } = useActiveProject()
  const { storiesById } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const [labels, setLabels] = useState<TimelineLabel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add-label form state
  const [isAdding, setIsAdding] = useState(false)
  const [newLabel, setNewLabel] = useState<string>('')
  const [newDescription, setNewDescription] = useState<string>('')
  const [newTimestamp, setNewTimestamp] = useState<string>(() =>
    new Date().toISOString().slice(0, 16),
  ) // yyyy-MM-ddTHH:mm
  const [scope, setScope] = useState<'project' | '__global__'>('project')

  // Edit-label popup state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState<string>('')
  const [editDescription, setEditDescription] = useState<string>('')
  const [editTimestamp, setEditTimestamp] = useState<string>('')
  const [editScope, setEditScope] = useState<'project' | '__global__'>('project')
  const [savingEdit, setSavingEdit] = useState(false)

  // Zoom state (Notion/Airtable-like)
  const [zoom, setZoom] = useState<Zoom>('day')

  // Hover state for callout
  const [hover, setHover] = useState<HoverInfo>(null)

  // Auto-scroll bookkeeping
  const hasInitialAutoScrolledRef = useRef(false)
  const prevZoomRef = useRef<Zoom>('day')

  const [showAllProjects, setShowAllProjects] = useState(false)

  const prevProjectIdRef = useRef(projectId)
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      hasInitialAutoScrolledRef.current = false // Retrigger auto-scroll
      setShowAllProjects(false) // Reset toggle on project change
      prevProjectIdRef.current = projectId
    }
  }, [projectId])

  const displayedStories = useMemo(() => {
    if (showAllProjects) {
      return Object.values(storiesById)
    }
    if (!project?.storyIdToDisplayIndex) {
      return []
    }
    const projectStoryIds = Object.keys(project.storyIdToDisplayIndex)
    return projectStoryIds.map((id) => storiesById[id]).filter(Boolean)
  }, [storiesById, project, showAllProjects])

  const displayedFeatures = useMemo(() => {
    return displayedStories
      .flatMap((t: any) =>
        (t.features || []).map((f: Feature) => ({ ...f, storyProjectId: t.projectId, storyId: t.id })),
      )
      .filter((f) => !!f.completedAt)
  }, [displayedStories])

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

    // Include stories for week/month so the range reflects stories when those views are active
    let ts: TimelineLabel[] = []
    if (zoom !== 'day') {
      ts = displayedStories
        .map((t: any) => mapStoryToTimelineLabel(t.projectId, t))
        .filter((x): x is TimelineLabel => !!x)
    }

    return [...fs, ...ts, ...labels].sort(
      (a, b) => new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime(),
    )
  }, [displayedFeatures, displayedStories, labels, zoom])

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
    let arr: Unit[] = []

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

  // Header groups based on units (month groups for day/week, year groups for month)
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

  // Grid column sizing based on zoom (one column per unit; min width changes)
  const cellMinWidth = useMemo(() => {
    switch (zoom) {
      case 'month':
        return 80
      case 'week':
        return 56
      default:
        return 72
    }
  }, [zoom])

  const gridTemplate = useMemo(
    () => `${LEFT_COL_WIDTH} repeat(${unitCount}, minmax(${cellMinWidth}px, 1fr))`,
    [unitCount, cellMinWidth],
  )

  // Build rows for features (day) or stories (week/month) and user-defined label rows
  const featureRows = useMemo(() => {
    const items: RowItem[] = displayedFeatures.map((f: any) => ({
      id: f.id,
      title: f.title,
      timestamp: f.completedAt ?? new Date().toISOString(),
      kind: 'feature',
      storyId: f.storyId,
    }))
    return [
      {
        key: 'features',
        title: 'Features (completed)',
        items,
      },
    ]
  }, [displayedFeatures])

  const storyRows = useMemo(() => {
    const items = displayedStories
      .map((t) => {
        const ts = getStoryCompletedAt(t)
        if (!ts) return null
        return {
          id: (t as any).id,
          title: (t as any).title,
          timestamp: ts,
          kind: 'story' as const,
        } as RowItem
      })
      .filter((x): x is RowItem => !!x)

    return [
      {
        key: 'stories',
        title: 'Stories (completed)',
        items,
      },
    ]
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
      const scopeOfItem: 'project' | '__global__' =
        l.projectId === projectId ? 'project' : '__global__'
      const grp = groups.get(k)!
      grp.items.push({
        id: l.id,
        title,
        timestamp: l.content.timestamp,
        scope: scopeOfItem,
        kind: 'label',
      })
      if (scopeOfItem === '__global__') grp.rowScope = '__global__'
    }
    // Sort: Global rows first, then by title
    return Array.from(groups.values()).sort((a, b) => {
      if (a.rowScope !== b.rowScope) return a.rowScope === '__global__' ? -1 : 1
      return a.title.localeCompare(b.title)
    })
  }, [labels, projectId])

  const dataRows = useMemo(
    () => (zoom === 'day' ? featureRows : storyRows),
    [featureRows, storyRows, zoom],
  )

  const allRows = useMemo(() => {
    // User label rows at the top; features or stories row below depending on zoom
    return [...labelRows, ...dataRows]
  }, [dataRows, labelRows])

  const onAddLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return
    try {
      const input: EntityInput = {
        projectId: scope === 'project' ? projectId : '__global__',
        type: ENTITY_TYPE,
        content: {
          timestamp: newTimestamp,
          label: newLabel.trim() || 'Label',
          description: newDescription.trim() || undefined,
        } as TimestampContent,
      }
      const created = await dbService.addEntity(input)
      const normalized: TimelineLabel = normalizeLabels([created])[0]
      setLabels((prev) => [...prev, normalized])
      setIsAdding(false)
      setNewLabel('')
      setNewDescription('')
      setNewTimestamp(new Date().toISOString().slice(0, 16))
      setScope('project')
    } catch (err: any) {
      console.error('Failed to add label', err)
      setError(err?.message || 'Failed to add label')
    }
  }

  const openEditFor = (id: string) => {
    const lbl = labels.find((l) => l.id === id)
    if (!lbl) return
    setEditingId(id)
    setEditLabel(lbl.content.label || '')
    setEditDescription(lbl.content.description || '')
    setEditTimestamp(tsToInput(lbl.content.timestamp))
    setEditScope(lbl.projectId === projectId ? 'project' : '__global__')
  }

  const closeEdit = () => {
    setEditingId(null)
    setSavingEdit(false)
  }

  const onSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setSavingEdit(true)
    try {
      const patch: Partial<EntityInput> = {
        projectId: editScope === 'project' ? projectId : '__global__',
        content: {
          label: editLabel.trim() || 'Label',
          description: editDescription.trim() || undefined,
          timestamp: editTimestamp,
        } as TimestampContent,
      }
      const updated = await dbService.updateEntity(editingId, patch)
      if (updated) {
        const norm = normalizeLabels([updated])[0]
        setLabels((prev) => prev.map((l) => (l.id === norm.id ? norm : l)))
      }
      closeEdit()
    } catch (err: any) {
      console.error('Failed to update label', err)
      setError(err?.message || 'Failed to update label')
      setSavingEdit(false)
    }
  }

  const onDeleteEdit = async () => {
    if (!editingId) return
    const lbl = labels.find((l) => l.id === editingId)
    const name = lbl?.content.label || 'this label'
    const ok = window.confirm(`Delete ${name}? This cannot be undone.`)
    if (!ok) return
    try {
      const success = await dbService.deleteEntity(editingId)
      if (success) setLabels((prev) => prev.filter((l) => l.id !== editingId))
      closeEdit()
    } catch (err: any) {
      console.error('Failed to delete label', err)
      setError(err?.message || 'Failed to delete label')
    }
  }

  const scrollToToday = () => {
    const container = document.getElementById('project-timeline-scroll')
    if (!container) return

    const todayIdx = getUnitIndex(zoom, startAligned, unitCount, new Date().toISOString())

    const cell = container.querySelector<HTMLElement>(`[data-unit-index="${todayIdx}"]`)
    if (!cell) {
      // Fallback approximate scroll if we cannot find the header cell
      const approxCell = cellMinWidth
      container.scrollTo({ left: todayIdx * approxCell, behavior: 'smooth' })
      return
    }

    const unitsRow = cell.closest<HTMLElement>('[data-units-row="true"]') || undefined
    const leftCol = unitsRow?.querySelector<HTMLElement>('[data-left-col="true"]') || undefined

    const leftColWidth = leftCol?.getBoundingClientRect().width ?? 0
    const containerRect = container.getBoundingClientRect()
    const cellRect = cell.getBoundingClientRect()

    const visibleRightWidth = Math.max(0, container.clientWidth - leftColWidth)
    const relativeLeft = cellRect.left - containerRect.left

    // Delta required to center the cell within the right-hand scrollable area
    const delta = relativeLeft - leftColWidth + cellRect.width / 2 - visibleRightWidth / 2
    const target = Math.max(0, Math.min(container.scrollWidth, container.scrollLeft + delta))

    container.scrollTo({ left: target, behavior: 'smooth' })
  }

  // Clear hover on scroll/resize to avoid stale positioning
  useEffect(() => {
    const onScrollOrResize = () => setHover(null)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [])

  // Auto-scroll to make today visible on initial load and when switching zoom modes
  useEffect(() => {
    if (loading) return
    const isZoomChange = prevZoomRef.current !== zoom

    if (!hasInitialAutoScrolledRef.current || isZoomChange) {
      // Wait for DOM to paint updated units before measuring/scanning
      requestAnimationFrame(() => {
        scrollToToday()
      })
      hasInitialAutoScrolledRef.current = true
      prevZoomRef.current = zoom
    }
  }, [loading, zoom, unitCount, startAligned, cellMinWidth])

  if (loading) {
    return <div className="p-4 text-secondary">Loading timeline...</div>
  }

  return (
    <div className="h-full flex flex-col" id="project-timeline-view">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-subtle bg-base sticky top-0 z-20">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-primary truncate">Project timeline</div>
          <div className="text-xs text-muted truncate">Project: {projectId}</div>
        </div>
        <div className="flex items-center gap-4">
          <Switch
            label="Show all projects"
            checked={showAllProjects}
            onCheckedChange={setShowAllProjects}
          />
          <div className="hidden sm:flex items-center rounded border border-subtle overflow-hidden">
            {(['day', 'week', 'month'] as Zoom[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={
                  'px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 ring-offset-1 ' +
                  (zoom === z
                    ? 'bg-accent-primary text-inverted'
                    : 'bg-raised text-secondary hover:text-primary')
                }
                aria-pressed={zoom === z}
              >
                {z.charAt(0).toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={scrollToToday}
            className="px-3 py-1.5 text-sm rounded border border-subtle bg-raised hover:bg-base text-primary"
          >
            Today
          </button>
          {!isAdding ? (
            <button
              className="px-3 py-1.5 text-sm rounded bg-accent-primary text-inverted hover:bg-accent-hover focus:outline-none focus-visible:ring-2 ring-offset-1"
              onClick={() => setIsAdding(true)}
            >
              + Add label
            </button>
          ) : (
            <button
              className="px-3 py-1.5 text-sm rounded border border-subtle bg-raised hover:bg-base text-primary"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          )}
          {error && <div className="text-xs text-red-600">{error}</div>}
        </div>
      </div>

      {isAdding && (
        <form
          onSubmit={onAddLabel}
          className="px-4 pt-3 pb-2 grid gap-2 sm:grid-cols-5 items-end bg-base border-b border-subtle"
        >
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-muted">Row label</label>
            <input
              className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Milestone A"
              required
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-muted">Description (optional)</label>
            <input
              className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short note"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-muted">When</label>
            <input
              type="datetime-local"
              className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-muted">Scope</label>
            <select
              className="h-9 rounded border border-default bg-raised px-2 text-sm text-primary focus:outline-none focus-visible:ring-2 ring-offset-1"
              value={scope}
              onChange={(e) => setScope(e.target.value as any)}
            >
              <option value="project">This project</option>
              <option value="__global__">All projects (global)</option>
            </select>
          </div>
          <div className="sm:col-span-5 flex justify-end">
            <button
              type="submit"
              className="px-3 py-1.5 text-sm rounded bg-accent-primary text-inverted hover:bg-accent-hover focus:outline-none focus-visible:ring-2 ring-offset-1"
            >
              Save label
            </button>
          </div>
        </form>
      )}

      {/* Scrollable timeline grid */}
      <div id="project-timeline-scroll" className="flex-1 overflow-auto bg-base">
        <div className="min-w-max">
          <div className="rounded border border-subtle overflow-hidden">
            {/* Header: groups + units */}
            <div className="sticky top-[var(--header-offset,0px)] z-10 bg-base">
              {/* Groups row */}
              <div
                className="grid border-b border-subtle"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <div className="sticky left-0 z-10 bg-base px-3 py-2 text-sm font-medium text-primary flex items-center">
                  Rows
                </div>
                {headerGroups.map((g, idx) => (
                  <div
                    key={`g-${idx}`}
                    className="px-2 py-2 text-xs text-secondary border-l border-subtle flex items-center"
                    style={{ gridColumnStart: 2 + g.startIdx, gridColumnEnd: `span ${g.len}` }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Units row */}
              <div
                className="grid bg-raised/50 border-b border-subtle"
                style={{ gridTemplateColumns: gridTemplate }}
                data-units-row="true"
              >
                <div
                  className="sticky left-0 z-10 bg-base px-3 py-2 text-xs font-medium text-secondary flex items-center"
                  data-left-col="true"
                ></div>
                {units.map((u, i) => {
                  const isToday =
                    zoom === 'day'
                      ? startOfDay(u.start).getTime() === startOfDay(new Date()).getTime()
                      : zoom === 'week'
                        ? startOfWeek(u.start).getTime() === startOfWeek(new Date()).getTime()
                        : startOfMonth(u.start).getTime() === startOfMonth(new Date()).getTime()
                  return (
                    <div
                      key={`h-${u.key}`}
                      className={`px-2 py-1.5 text-[11px] leading-4 text-secondary border-l border-subtle flex flex-col items-start ${
                        isToday ? 'bg-status-review-soft-bg/30' : ''
                      }`}
                      data-unit-index={i}
                    >
                      <span className="font-medium text-primary">{u.labelTop}</span>
                      {u.labelBottom ? <span>{u.labelBottom}</span> : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            {allRows.map((row) => (
              <div key={row.key} className="relative">
                <div className="grid relative" style={{ gridTemplateColumns: gridTemplate }}>
                  {/* Row label */}
                  <div className="sticky left-0 z-10 bg-base px-3 py-2 text-sm font-medium text-primary flex items-start border-b border-subtle">
                    {row.title}
                  </div>

                  {/* Build buckets per unit for this row so items can stack from top */}
                  {(() => {
                    const buckets: RowItem[][] = Array.from({ length: unitCount }, () => [])
                    for (const it of row.items as RowItem[]) {
                      const idx = getUnitIndex(zoom, startAligned, unitCount, it.timestamp)
                      if (idx < 0 || idx >= unitCount) continue
                      buckets[idx].push(it)
                    }
                    // sort each bucket by timestamp ascending
                    for (let i = 0; i < buckets.length; i++) {
                      buckets[i].sort(
                        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
                      )
                    }

                    // Render one cell per unit with items stacked from the top
                    return buckets.map((itemsInCell, i) => (
                      <div
                        key={`c-${row.key}-${i}`}
                        className="border-l border-b border-subtle px-1 py-1 flex flex-col items-stretch gap-1"
                      >
                        {itemsInCell.map((it) => {
                          const kind = it.kind
                          const isLabel = kind === 'label'
                          const isFeature = kind === 'feature'

                          const pillBase =
                            'pointer-events-auto rounded-md px-2 py-1 text-xs shadow-sm border whitespace-nowrap max-w-[12rem] relative group truncate'

                          const labelProjectStyles =
                            'bg-status-review-soft-bg text-status-review-soft-fg border-status-review-soft-border'
                          const labelGlobalStyles =
                            'bg-status-on_hold-soft-bg text-status-on_hold-soft-fg border-status-on_hold-soft-border'

                          const className = `${pillBase} ${
                            isLabel
                              ? (it as any).scope === 'project'
                                ? labelProjectStyles
                                : labelGlobalStyles
                              : ''
                          }`

                          const style = !isLabel
                            ? storyColorStyles(isFeature ? it.storyId : it.id)
                            : undefined

                          const onMouseEnter: React.MouseEventHandler<HTMLDivElement> = (e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            if (kind === 'story') {
                              setHover({ kind: 'story', storyId: it.id, rect })
                            } else if (kind === 'feature') {
                              setHover({
                                kind: 'feature',
                                storyId: (it as any).storyId!,
                                featureId: it.id,
                                rect,
                              })
                            } else {
                              setHover(null)
                            }
                          }
                          const onMouseLeave: React.MouseEventHandler<HTMLDivElement> = () => {
                            setHover((prev) => (prev ? null : prev))
                          }

                          const onClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
                            if (kind === 'story') {
                              navigateStoryDetails(it.id, undefined, true)
                            } else if (kind === 'feature') {
                              navigateStoryDetails((it as any).storyId!, it.id)
                            }
                          }

                          return (
                            <div
                              key={it.id}
                              className={className}
                              style={style}
                              title={`${it.title}\n${new Date(it.timestamp).toLocaleString()}`}
                              onMouseEnter={onMouseEnter}
                              onMouseLeave={onMouseLeave}
                              onClick={onClick}
                            >
                              {/* Hover edit button for user labels */}
                              {isLabel && (
                                <button
                                  type="button"
                                  onClick={() => openEditFor(it.id)}
                                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded-full bg-base border border-subtle text-secondary hover:text-primary shadow-sm"
                                  title="Edit label"
                                >
                                  ✎
                                </button>
                              )}
                              <div className="truncate font-medium pr-4">{it.title}</div>
                              <div className="opacity-80 text-[10px]">
                                {new Date(it.timestamp).toLocaleDateString()}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  })()}
                </div>

                {/* Today marker line */}
                {(() => {
                  let idx = 0
                  if (zoom === 'day')
                    idx = clamp(diffInDays(startAligned, new Date()), 0, unitCount - 1)
                  else if (zoom === 'week')
                    idx = clamp(diffInWeeks(startAligned, new Date()), 0, unitCount - 1)
                  else idx = clamp(diffInMonths(startAligned, new Date()), 0, unitCount - 1)
                  return (
                    <div
                      className="pointer-events-none absolute inset-y-0"
                      style={{ gridArea: '1 / 1 / 1 / 1' }}
                    >
                      <div
                        className="absolute inset-y-0 w-0.5 bg-accent-primary/60"
                        style={{
                          left: `calc(${LEFT_COL_WIDTH} + ${(idx + 0.5) * Math.max(cellMinWidth, 1)}px)`,
                        }}
                        aria-hidden
                      />
                    </div>
                  )
                })()}
              </div>
            ))}

            {allRows.length === 0 && (
              <div className="p-6 text-sm text-secondary">
                No timeline items yet. Add your first label above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover callout (fixed-position, pointer-events: none) */}
      {hover && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            top: Math.max(8, hover.rect.top + window.scrollY - 4),
            left: Math.min(
              window.scrollX + window.innerWidth - 320,
              hover.rect.left + window.scrollX + hover.rect.width + 8,
            ),
          }}
        >
          {hover.kind === 'story'
            ? (() => {
                const t = storiesById[hover.storyId]
                if (!t) return null
                const displayId = String(project?.storyIdToDisplayIndex?.[t.id] ?? t.id)
                return (
                  <StorySummaryCallout
                    title={t.title}
                    description={(t as any)?.description || ''}
                    status={t.status}
                    displayId={displayId}
                  />
                )
              })()
            : hover.kind === 'feature'
              ? (() => {
                  const t = storiesById[hover.storyId]
                  const f = t?.features.find((x) => x.id === hover.featureId)
                  if (!t || !f) return null
                  const displayId = String(t.featureIdToDisplayIndex?.[f.id] ?? f.id)
                  return (
                    <FeatureSummaryCallout
                      title={f.title}
                      description={f.description || ''}
                      status={f.status}
                      displayId={displayId}
                    />
                  )
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

function uuidv4(): string {
  // RFC 4122-ish UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
