import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Feature, Story } from 'thefactory-tools'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject, useProjectContext } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import type { Entity, EntityInput } from 'thefactory-db'
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
  const { getStoryDisplayIndex } = useProjectContext()
  const { storiesById, getFeatureDisplayIndex } = useStories()
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
    if (showAllProjects) return Object.values(storiesById)
    if (!project) return []
    return project.storyIds.map((id) => storiesById[id]).filter(Boolean)
  }, [storiesById, project, showAllProjects])

  const displayedFeatures = useMemo(() => {
    return displayedStories
      .flatMap((t) =>
        (t.features || []).map((f: Feature) => ({
          ...f,
          storyProjectId: projectId,
          storyId: t.id,
        })),
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
    const items: RowItem[] = displayedFeatures.map((f) => ({
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

  const rows = useMemo(() => {
    if (zoom === 'day') return [...featureRows, ...labelRows]
    return [...storyRows, ...labelRows]
  }, [zoom, featureRows, storyRows, labelRows])

  // Refs for scrolling logic
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const headerContainerRef = useRef<HTMLDivElement>(null)
  const initialScrollTargetRef = useRef<HTMLDivElement>(null)

  // Sync horizontal scroll between body and sticky header
  const handleScroll = () => {
    if (scrollContainerRef.current && headerContainerRef.current) {
      headerContainerRef.current.scrollLeft = scrollContainerRef.current.scrollLeft
    }
  }

  // Auto-scroll to current day (or appropriate view) on initial load or zoom change
  useEffect(() => {
    if (loading || units.length === 0) return

    if (!hasInitialAutoScrolledRef.current || prevZoomRef.current !== zoom) {
      // Small timeout to let DOM render sizes
      setTimeout(() => {
        if (scrollContainerRef.current && initialScrollTargetRef.current) {
          const container = scrollContainerRef.current
          const target = initialScrollTargetRef.current
          // Calculate offset to center the target
          const targetLeft = target.offsetLeft
          const targetWidth = target.offsetWidth
          const containerWidth = container.offsetWidth
          const targetScrollLeft = targetLeft - containerWidth / 2 + targetWidth / 2

          container.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'auto',
          })
          hasInitialAutoScrolledRef.current = true
          prevZoomRef.current = zoom
        }
      }, 50)
    }
  }, [loading, units, zoom, labels, displayedFeatures])

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

      if (pid !== target.projectId) {
        // Change project id? DB updateEntity currently respects patch.
      }
      const updated = await dbService.updateEntity(editingId, {
        projectId: pid,
        content: {
          ...(target.content as Record<string, any>),
          timestamp: new Date(editTimestamp).toISOString(),
          label: editLabel.trim(),
          description: editDescription.trim() || undefined,
        },
      })
      setLabels((prev) =>
        prev.map((x) => (x.id === editingId ? normalizeLabels([updated!])[0] : x)),
      )
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
            <Switch
              key="allProjectsSwitch"
              checked={showAllProjects}
              onCheckedChange={setShowAllProjects}
            />
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
        <form
          onSubmit={onAddLabel}
          className="shrink-0 border-b border-default bg-raised p-4 flex flex-col gap-3"
        >
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

      {error && (
        <div className="shrink-0 p-4 m-4 border border-red-200 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 relative flex flex-col bg-base overflow-hidden">
        {/* Sticky Header Grid Container */}
        <div
          ref={headerContainerRef}
          className="shrink-0 w-full overflow-hidden border-b border-default bg-raised pointer-events-none"
        >
          <div
            className="grid text-xs text-muted pointer-events-auto"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Top-left empty block */}
            <div className="sticky left-0 z-20 bg-raised border-r border-default h-[3.5rem]" />

            {/* Units header (2 rows of grouping + column headers) */}
            <div className="col-start-2 relative h-[3.5rem]" style={{ gridColumnEnd: -1 }}>
              {/* Grouping row (Months / Years) */}
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
                  const isCurrentDay =
                    zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
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
                      {u.labelBottom && (
                        <div className="text-[9px] opacity-75">{u.labelBottom}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Grid Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 w-full overflow-auto relative"
        >
          {loading && labels.length === 0 ? (
            <div className="p-4 text-sm text-muted">Loading timeline...</div>
          ) : (
            <div className="grid pb-12" style={{ gridTemplateColumns: gridTemplate }}>
              {rows.map((row, rIdx) => (
                <React.Fragment key={row.key}>
                  {/* Left row header (Sticky) */}
                  <div
                    className="sticky left-0 z-10 flex items-center bg-base border-r border-default border-b px-3 py-2"
                    style={{ gridRow: rIdx + 1 }}
                  >
                    <div className="text-sm font-medium text-primary truncate" title={row.title}>
                      {row.title}
                    </div>
                  </div>

                  {/* Row background cells and content */}
                  <div
                    className="relative border-b border-subtle"
                    style={{ gridColumn: `2 / -1`, gridRow: rIdx + 1 }}
                  >
                    {/* Background grid lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {units.map((u, i) => {
                        const isCurrentDay =
                          zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
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

                    {/* Timeline items mapped to positions */}
                    <div className="relative h-12 w-full">
                      {row.items.map((item, iIdx) => {
                        const isGlobal = item.scope === '__global__'
                        const uIdx = getUnitIndex(zoom, startAligned, unitCount, item.timestamp)
                        // Target day (approx 50% through the column cell width)
                        const leftPct = (uIdx + 0.5) * (100 / unitCount)
                        const isCurrentDay =
                          zoom === 'day' &&
                          diffInDays(units[uIdx].start, startOfDay(new Date())) === 0

                        // Stagger items vertically if multiple on same unit
                        // Using modulo index to loosely distribute
                        const topOffsets = ['top-2', 'top-4', 'top-6', 'top-1']
                        const topClass = topOffsets[iIdx % topOffsets.length]

                        let contentEl = null
                        if (item.kind === 'label') {
                          // Milestone marker
                          contentEl = (
                            <div className={`absolute ${topClass} flex items-center gap-1`}>
                              <div
                                className={`w-3 h-3 rotate-45 border cursor-pointer hover:scale-110 transition-transform ${isGlobal ? 'bg-purple-200 border-purple-500' : 'bg-emerald-200 border-emerald-500'}`}
                                onClick={() => {
                                  const l = labels.find((x) => x.id === item.id)
                                  if (l) openEdit(l)
                                }}
                                title="Click to edit"
                              />
                            </div>
                          )
                        } else {
                          // Story or Feature (dot or chip)
                          const style = storyColorStyles(item.storyId)
                          contentEl = (
                            <div
                              className={`absolute ${topClass} flex flex-col items-center cursor-pointer hover:z-10`}
                              onClick={() => {
                                if (item.storyId) navigateStoryDetails(item.storyId)
                                else if (item.kind === 'story')
                                  navigateStoryDetails(item.id.replace('story-', ''))
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                if (item.kind === 'story') {
                                  setHover({
                                    kind: 'story',
                                    storyId: item.id.replace('story-', ''),
                                    rect,
                                  })
                                } else if (item.kind === 'feature') {
                                  setHover({
                                    kind: 'feature',
                                    storyId: item.storyId!,
                                    featureId: item.id,
                                    rect,
                                  })
                                }
                              }}
                              onMouseLeave={() => setHover(null)}
                            >
                              {zoom === 'day' ? (
                                <div
                                  className="w-3 h-3 rounded-full border shadow-sm transition-transform hover:scale-125"
                                  style={style}
                                />
                              ) : (
                                <div
                                  className="px-1.5 py-0.5 rounded text-[10px] font-medium border shadow-sm max-w-[80px] truncate"
                                  style={style}
                                  title={item.title}
                                >
                                  {item.title}
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <div
                            key={item.id}
                            className="absolute h-full w-0 flex justify-center z-10"
                            style={{ left: `${leftPct}%` }}
                            ref={isCurrentDay ? initialScrollTargetRef : null}
                          >
                            {contentEl}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
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
                const displayId = String(getStoryDisplayIndex(projectId, t.id) ?? t.id)
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
                  const displayId = String(getFeatureDisplayIndex(t.id, f.id) ?? f.id)
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
