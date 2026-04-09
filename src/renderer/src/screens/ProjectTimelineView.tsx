import React from 'react'
import { Feature, Story } from 'thefactory-tools'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject, useProjectContext } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import type { Entity, EntityInput } from 'thefactory-db'
import { useNavigator } from '../navigation/Navigator'
import { Switch } from '../components/ui/Switch'

import type {
  HoverInfo,
  RowDefinition,
  TimelineLabel,
  Unit,
  Zoom,
} from './projectTimeline/ProjectTimelineTypes'
import { TimelineHoverCard } from './projectTimeline/TimelineHoverCard'
import { TimelineGridRow } from './projectTimeline/TimelineGridRow'
import {
  addDays,
  addMonths,
  addWeeks,
  diffInDays,
  diffInMonths,
  diffInWeeks,
  isoWeekNumber,
  startOfDay,
  startOfMonth,
  startOfWeek,
  tsToInput,
} from './projectTimeline/timelineDateUtils'
import {
  buildAllProjectsRows,
  buildLabelRows,
  ENTITY_TYPE,
  getStoryCompletedAt,
  mapFeatureToTimelineLabel,
  mapStoryToTimelineLabel,
  normalizeLabels,
} from './projectTimeline/timelineItemUtils'

const ROW_HEIGHT_PX = 220
const COLUMN_WIDTH_PX = 200
const HEADER_HEIGHT_PX = 56
const DEFAULT_WINDOW_DAYS = 30
const LEFT_COL_WIDTH_PX = 96 // 6rem
const PROJECT_COL_WIDTH_PX = 88 // 5.5rem
const YEAR_STRIP_HEIGHT_PX = 22
const DATE_STRIP_HEIGHT_PX = HEADER_HEIGHT_PX - YEAR_STRIP_HEIGHT_PX
const STORY_COUNT_COLOR = 'bg-emerald-200 border-emerald-500'
const FEATURE_COUNT_COLOR = 'bg-purple-200 border-purple-500'

type HeaderGroup = { label: string; startIdx: number; len: number }
type YearStripGroup = HeaderGroup & { leftPx: number; widthPx: number }

function TimelineToolbar({
  zoom,
  setZoom,
  showAllProjects,
  setShowAllProjects,
  isAdding,
  setIsAdding,
}: {
  zoom: Zoom
  setZoom: (z: Zoom) => void
  showAllProjects: boolean
  setShowAllProjects: (v: boolean) => void
  isAdding: boolean
  setIsAdding: (v: boolean) => void
}) {
  return (
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
  )
}

function AddLabelForm({
  projectId,
  loading,
  onAddLabel,
  newLabel,
  setNewLabel,
  newDescription,
  setNewDescription,
  newTimestamp,
  setNewTimestamp,
  scope,
  setScope,
}: {
  projectId: string | undefined
  loading: boolean
  onAddLabel: (e: React.FormEvent) => void
  newLabel: string
  setNewLabel: (v: string) => void
  newDescription: string
  setNewDescription: (v: string) => void
  newTimestamp: string
  setNewTimestamp: (v: string) => void
  scope: 'project' | '__global__'
  setScope: (v: 'project' | '__global__') => void
}) {
  void projectId
  return (
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
  )
}

export default function ProjectTimelineView() {
  const { projectId, project } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById, storyIdsByProject } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const [labels, setLabels] = React.useState<TimelineLabel[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [isAdding, setIsAdding] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState<string>('')
  const [newDescription, setNewDescription] = React.useState<string>('')
  const [newTimestamp, setNewTimestamp] = React.useState<string>(() =>
    new Date().toISOString().slice(0, 16),
  )
  const [scope, setScope] = React.useState<'project' | '__global__'>('project')

  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editLabel, setEditLabel] = React.useState<string>('')
  const [editDescription, setEditDescription] = React.useState<string>('')
  const [editTimestamp, setEditTimestamp] = React.useState<string>('')
  const [editScope, setEditScope] = React.useState<'project' | '__global__'>('project')
  const [savingEdit, setSavingEdit] = React.useState(false)

  const [zoom, setZoom] = React.useState<Zoom>('day')
  const [hover, setHover] = React.useState<HoverInfo>(null)
  const [showAllProjects, setShowAllProjects] = React.useState(false)
  const [yearStripScrollLeft, setYearStripScrollLeft] = React.useState(0)
  const [yearStripViewportWidth, setYearStripViewportWidth] = React.useState(0)

  // Refs for split-view scroll sync
  const rightScrollRef = React.useRef<HTMLDivElement>(null)
  const leftScrollRef = React.useRef<HTMLDivElement>(null)
  const yearStripRef = React.useRef<HTMLDivElement>(null)

  // Auto-scroll bookkeeping
  const hasInitialAutoScrolledRef = React.useRef(false)
  const prevZoomRef = React.useRef<Zoom>('day')

  const prevProjectIdRef = React.useRef(projectId)
  React.useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      hasInitialAutoScrolledRef.current = false
      setShowAllProjects(false)
      prevProjectIdRef.current = projectId
    }
  }, [projectId])

  const storyProjectIdByStoryId = React.useMemo(() => {
    const out: Record<string, string> = {}
    for (const p of Object.keys(storyIdsByProject)) {
      const storyIds = storyIdsByProject[p]
      for (const storyId of storyIds) {
        out[storyId] = p
      }
    }
    return out
  }, [storyIdsByProject])

  const displayedStories = React.useMemo(() => {
    if (showAllProjects) {
      return Object.values(storiesById)
        .map((story) => ({
          ...(story as any),
          projectId: storyProjectIdByStoryId[(story as any).id],
        }))
        .filter((story: any) => !!story.projectId)
    }
    if (!project) return []
    return storyIdsByProject[project.id]
      .map((id) => {
        const story = storiesById[id]
        return story
          ? ({ ...(story as any), projectId: project.id } as Story & { projectId: string })
          : null
      })
      .filter(Boolean) as Array<Story & { projectId: string }>
  }, [storiesById, project, showAllProjects, storyProjectIdByStoryId])

  const displayedFeatures = React.useMemo(() => {
    return displayedStories
      .flatMap((t: any) =>
        (t.features || []).map((f: Feature) => ({
          ...f,
          storyProjectId: (t as any).projectId,
          storyId: (t as any).id,
        })),
      )
      .filter((f: any) => !!f.completedAt)
  }, [displayedStories])

  // Fetch timeline labels
  React.useEffect(() => {
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

    void fetchTimelineData()
  }, [projectId, showAllProjects])

  const timelineItems = React.useMemo(() => {
    const fs = displayedFeatures.map((f: any) => mapFeatureToTimelineLabel(f.storyProjectId, f))
    const ts = displayedStories
      .map((t: any) => mapStoryToTimelineLabel(t.projectId ?? projectId ?? 'noproj', t))
      .filter((x): x is TimelineLabel => !!x)

    return [...fs, ...ts, ...labels].sort(
      (a, b) => new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime(),
    )
  }, [displayedFeatures, displayedStories, labels, projectId])

  const { rawStartDate, rawEndDate } = React.useMemo(() => {
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

  const { units, unitCount, startAligned } = React.useMemo(() => {
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
          labelTop: `${d.toLocaleDateString(undefined, { month: 'short' })} ${d.toLocaleDateString(undefined, { day: 'numeric' })}`,
          labelBottom: d.toLocaleDateString(undefined, { weekday: 'short' }),
          groupLabel: d.toLocaleDateString(undefined, { year: 'numeric' }),
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
        const yearStr = d.toLocaleDateString(undefined, { year: '2-digit' })
        arr.push({
          key: `w-${d.toISOString().slice(0, 10)}`,
          start: d,
          labelTop: `Wk ${wk}`,
          labelBottom: `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${yearStr}`,
          groupLabel: d.toLocaleDateString(undefined, { year: 'numeric' }),
        })
      }
      return { units: arr, unitCount: arr.length, startAligned: start }
    }

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
        labelBottom: '',
        groupLabel: String(d.getFullYear()),
      })
    }
    return { units: arr, unitCount: arr.length, startAligned: start }
  }, [rawStartDate, rawEndDate, zoom])

  const headerGroups = React.useMemo(() => {
    const groups: HeaderGroup[] = []
    let current = ''
    let startIdx = 0
    for (let i = 0; i < units.length; i++) {
      const g = units[i].groupLabel
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

  const featureRowSingleProject = React.useMemo<RowDefinition>(() => {
    const items = displayedFeatures.map((f: any) => ({
      id: f.id,
      title: f.title,
      timestamp: f.completedAt ?? new Date().toISOString(),
      kind: 'feature' as const,
      storyId: f.storyId,
      projectId: f.storyProjectId,
    }))
    return { key: 'features', title: 'Features', items }
  }, [displayedFeatures])

  const storyRowSingleProject = React.useMemo<RowDefinition>(() => {
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
        }
      })
      .filter(Boolean) as any[]

    return { key: 'stories', title: 'Stories', items }
  }, [displayedStories])

  const labelRows = React.useMemo(() => buildLabelRows(labels, projectId), [labels, projectId])

  const rows = React.useMemo<RowDefinition[]>(() => {
    if (!showAllProjects) return [featureRowSingleProject, storyRowSingleProject, ...labelRows]
    const all = buildAllProjectsRows({
      projects,
      displayedFeatures: displayedFeatures as any[],
      displayedStories: displayedStories as any[],
    })
    return [...all, ...labelRows]
  }, [
    showAllProjects,
    featureRowSingleProject,
    storyRowSingleProject,
    labelRows,
    projects,
    displayedFeatures,
    displayedStories,
  ])

  const totalTimelineWidth = unitCount * COLUMN_WIDTH_PX

  const yearStripGroups = React.useMemo<YearStripGroup[]>(() => {
    return headerGroups.map((g) => ({
      ...g,
      leftPx: g.startIdx * COLUMN_WIDTH_PX,
      widthPx: g.len * COLUMN_WIDTH_PX,
    }))
  }, [headerGroups])

  React.useEffect(() => {
    const el = rightScrollRef.current
    if (!el) return
    setYearStripScrollLeft(el.scrollLeft)
    setYearStripViewportWidth(el.clientWidth)
  }, [unitCount, zoom, showAllProjects, rows.length])

  const countsByUnit = React.useMemo(() => {
    const bucketKey = (date: Date) => {
      if (zoom === 'day') return `d-${startOfDay(date).toISOString().slice(0, 10)}`
      if (zoom === 'week') return `w-${startOfWeek(date).toISOString().slice(0, 10)}`
      const m = startOfMonth(date)
      return `m-${m.getFullYear()}-${m.getMonth()}`
    }

    const out: Record<string, { stories: number; features: number }> = {}
    for (const u of units) out[u.key] = { stories: 0, features: 0 }

    for (const story of displayedStories as any[]) {
      const ts = getStoryCompletedAt(story as any)
      if (!ts) continue
      const key = bucketKey(new Date(ts))
      if (out[key]) out[key].stories += 1
    }

    for (const feature of displayedFeatures as any[]) {
      if (!feature.completedAt) continue
      const key = bucketKey(new Date(feature.completedAt))
      if (out[key]) out[key].features += 1
    }

    return out
  }, [units, zoom, displayedStories, displayedFeatures])

  const handleRightScroll = React.useCallback(() => {
    const el = rightScrollRef.current
    if (!el) return
    if (yearStripRef.current) {
      yearStripRef.current.scrollLeft = el.scrollLeft
    }
    setYearStripScrollLeft(el.scrollLeft)
    setYearStripViewportWidth(el.clientWidth)
    if (leftScrollRef.current) {
      leftScrollRef.current.scrollTop = el.scrollTop
    }
  }, [])

  // Auto-scroll to END (rightmost) on initial load or zoom change
  React.useEffect(() => {
    if (loading || units.length === 0) return

    if (!hasInitialAutoScrolledRef.current || prevZoomRef.current !== zoom) {
      requestAnimationFrame(() => {
        const container = rightScrollRef.current
        if (!container) return
        container.scrollTo({ left: container.scrollWidth, behavior: 'auto' })
        hasInitialAutoScrolledRef.current = true
        prevZoomRef.current = zoom
      })
    }
  }, [loading, units.length, zoom])

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

  const onClickStory = (storyId: string) => {
    navigateStoryDetails(String(storyId).replace('story-', ''))
  }

  const onClickFeature = (storyId: string) => {
    navigateStoryDetails(storyId)
  }

  return (
    <div className="flex flex-col h-full bg-base text-primary overflow-hidden">
      <TimelineToolbar
        zoom={zoom}
        setZoom={setZoom}
        showAllProjects={showAllProjects}
        setShowAllProjects={setShowAllProjects}
        isAdding={isAdding}
        setIsAdding={setIsAdding}
      />

      {isAdding ? (
        <AddLabelForm
          projectId={projectId}
          loading={loading}
          onAddLabel={onAddLabel}
          newLabel={newLabel}
          setNewLabel={setNewLabel}
          newDescription={newDescription}
          setNewDescription={setNewDescription}
          newTimestamp={newTimestamp}
          setNewTimestamp={setNewTimestamp}
          scope={scope}
          setScope={setScope}
        />
      ) : null}

      {error ? (
        <div className="shrink-0 p-4 m-4 border border-red-200 bg-red-50 text-red-600 rounded">
          {error}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 relative flex bg-base overflow-hidden">
        {/* LEFT PANE */}
        <div
          className="flex flex-col shrink-0 border-r border-default bg-raised z-30 shadow-sm"
          style={{ width: (showAllProjects ? PROJECT_COL_WIDTH_PX : 0) + LEFT_COL_WIDTH_PX }}
        >
          {/* Top-Left Header Cell */}
          <div
            className="shrink-0 flex items-center justify-between px-2 border-b border-default bg-raised"
            style={{ height: HEADER_HEIGHT_PX }}
          >
            <div className="flex items-center gap-1.5 cursor-default" title="Features">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-purple-200 border border-purple-500" />
              <span className="font-medium text-primary text-xs">{displayedFeatures.length}</span>
            </div>
            <div className="flex items-center gap-1.5 cursor-default" title="Stories">
              <span className="font-medium text-primary text-xs">{displayedStories.length}</span>
              <span className="w-2.5 h-2.5 rounded-[2px] bg-emerald-200 border border-emerald-500" />
            </div>
          </div>

          {/* Left Body Cells */}
          <div
            className="flex-1 overflow-hidden"
            ref={leftScrollRef}
            onWheel={(e) => {
              if (rightScrollRef.current) {
                rightScrollRef.current.scrollTop += e.deltaY
              }
            }}
          >
            <div className="pb-12">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex border-b border-default bg-base"
                  style={{ height: ROW_HEIGHT_PX }}
                >
                  {showAllProjects ? (
                    <div
                      className="shrink-0 flex items-center justify-center p-2 border-r border-default overflow-hidden"
                      style={{ width: PROJECT_COL_WIDTH_PX }}
                      title={row.projectTitle || ''}
                    >
                      <span className="text-[11px] leading-tight font-medium text-primary text-center break-words overflow-hidden">
                        {row.projectTitle || ''}
                      </span>
                    </div>
                  ) : null}
                  <div
                    className="flex-1 flex flex-col justify-center items-center p-2 min-w-0"
                    title={row.title}
                  >
                    <span className="text-[11px] leading-tight font-medium text-primary text-center break-words overflow-hidden mb-2">
                      {row.title}
                    </span>
                    {row.key.endsWith('-features') || row.key === 'features' ? (
                      <div className="flex items-center gap-1.5" title="Features in this row">
                        <span className="w-2 h-2 rounded-[2px] bg-purple-200 border border-purple-500" />
                        <span className="text-[10px] font-medium text-muted">
                          {row.items.length}
                        </span>
                      </div>
                    ) : null}
                    {row.key.endsWith('-stories') || row.key === 'stories' ? (
                      <div className="flex items-center gap-1.5" title="Stories in this row">
                        <span className="w-2 h-2 rounded-[2px] bg-emerald-200 border border-emerald-500" />
                        <span className="text-[10px] font-medium text-muted">
                          {row.items.length}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          <div
            className="absolute top-0 left-0 right-0 overflow-hidden bg-blue-50 border-b border-default z-50 pointer-events-none"
            style={{ height: YEAR_STRIP_HEIGHT_PX }}
          >
            <div ref={yearStripRef} className="h-full overflow-hidden">
              <div className="relative h-full" style={{ width: totalTimelineWidth }}>
                {yearStripGroups.map((g, idx) => {
                  const visibleLeft = Math.max(g.leftPx, yearStripScrollLeft)
                  const visibleRight = Math.min(
                    g.leftPx + g.widthPx,
                    yearStripScrollLeft + yearStripViewportWidth,
                  )
                  const visibleWidth = Math.max(0, visibleRight - visibleLeft)
                  const naturalCenter = g.leftPx + g.widthPx / 2
                  const visibleCenter = visibleLeft + visibleWidth / 2
                  const labelHalfWidth = 34
                  const canFitLabel = visibleWidth > labelHalfWidth * 2
                  const minVisibleCenter = visibleLeft + labelHalfWidth
                  const maxVisibleCenter = visibleRight - labelHalfWidth
                  const safeVisibleCenter = canFitLabel
                    ? Math.max(minVisibleCenter, Math.min(visibleCenter, maxVisibleCenter))
                    : visibleCenter
                  const visibleCoverage = g.widthPx > 0 ? visibleWidth / g.widthPx : 0
                  const naturalAllowed =
                    naturalCenter >= minVisibleCenter && naturalCenter <= maxVisibleCenter
                  const rawBlend = naturalAllowed
                    ? Math.max(0, Math.min(1, (visibleCoverage - 0.7) / 0.3))
                    : 0
                  const easedBlend = rawBlend * rawBlend * (3 - 2 * rawBlend)
                  const finalCenter = Math.round(
                    safeVisibleCenter + (naturalCenter - safeVisibleCenter) * easedBlend,
                  )
                  const labelLeft = finalCenter - g.leftPx

                  return (
                    <div
                      key={idx}
                      className="absolute top-0 h-full overflow-hidden"
                      style={{
                        left: g.leftPx,
                        width: g.widthPx,
                        borderLeft: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      {visibleWidth > 0 ? (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2 py-1 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap text-primary bg-raised rounded-sm"
                          style={{ left: labelLeft }}
                        >
                          {g.label}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto" ref={rightScrollRef} onScroll={handleRightScroll}>
            {loading && labels.length === 0 ? (
              <div className="p-4 text-sm text-muted">Loading timeline...</div>
            ) : (
              <div style={{ width: totalTimelineWidth }}>
                <div
                  className="sticky top-0 border-b border-default z-40 overflow-hidden  bg-blue-50"
                  style={{ height: HEADER_HEIGHT_PX, minHeight: HEADER_HEIGHT_PX }}
                >
                  <div
                    className="absolute left-0 w-full flex bg-raised"
                    style={{
                      top: YEAR_STRIP_HEIGHT_PX,
                      height: DATE_STRIP_HEIGHT_PX,
                      minHeight: DATE_STRIP_HEIGHT_PX,
                      background: 'var(--color-raised)',
                    }}
                  >
                    {units.map((u, i) => {
                      const isCurrentDay =
                        zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
                      const counts = countsByUnit[u.key] || { stories: 0, features: 0 }
                      return (
                        <div
                          key={u.key}
                          className={`flex-none flex items-center justify-between gap-2 px-2 border-subtle ${isCurrentDay ? 'bg-accent-primary/10 text-accent-primary font-bold' : ''}`}
                          style={{
                            width: COLUMN_WIDTH_PX,
                            borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                            background: isCurrentDay ? undefined : 'var(--color-raised)',
                          }}
                        >
                          <div className="flex items-center gap-1 min-w-0" title="Stories">
                            <span className="text-[10px] leading-none">{counts.stories}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-[2px] border ${STORY_COUNT_COLOR}`}
                            />
                          </div>
                          <div className="min-w-0 text-center flex-1">
                            <div className="text-[11px] leading-tight truncate">{u.labelTop}</div>
                            {u.labelBottom ? (
                              <div className="text-[9px] opacity-75 truncate">{u.labelBottom}</div>
                            ) : null}
                          </div>
                          <div
                            className="flex items-center gap-1 min-w-0 justify-end"
                            title="Features"
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-[2px] border ${FEATURE_COUNT_COLOR}`}
                            />
                            <span className="text-[10px] leading-none">{counts.features}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pb-12">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="relative border-b border-subtle bg-base"
                      style={{ height: ROW_HEIGHT_PX, overflow: 'hidden' }}
                    >
                      <TimelineGridRow
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
                        onClickFeature={onClickFeature as any}
                        timelineWidthPx={totalTimelineWidth}
                        rowHeightPx={ROW_HEIGHT_PX}
                        scrollLeft={0}
                        columnWidthPx={COLUMN_WIDTH_PX}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TimelineHoverCard
        hover={hover}
        showAllProjects={showAllProjects}
        storiesById={storiesById as any}
        projects={projects as any}
        activeProject={project as any}
      />

      {editingId ? (
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
      ) : null}
    </div>
  )
}
