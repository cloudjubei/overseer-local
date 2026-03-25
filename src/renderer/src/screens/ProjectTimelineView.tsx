import React from 'react'
import { Feature } from 'thefactory-tools'
import { useStories } from '../contexts/StoriesContext'
import { useActiveProject, useProjectContext } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import type { Entity, EntityInput } from 'thefactory-db'
import { useNavigator } from '../navigation/Navigator'
import { Switch } from '../components/ui/Switch'

import type { HoverInfo, RowDefinition, TimelineLabel, Unit, Zoom } from './projectTimeline/ProjectTimelineTypes'
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

const DEFAULT_WINDOW_DAYS = 30
const LEFT_COL_WIDTH_PX = 256 // 16rem
const PROJECT_COL_WIDTH_PX = 224 // 14rem

// Make rows taller to avoid overlap, but keep per-cell scrolling for high density
const ROW_HEIGHT_PX = 220

// Standardised column width across DAY|WEEK|MONTH
const COLUMN_WIDTH_PX = 200

const HEADER_HEIGHT_PX = 56

type HeaderGroup = { label: string; startIdx: number; len: number }

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
  )
}

function TimelineHeader({
  showAllProjects,
  headerGroups,
  units,
  unitCount,
  zoom,
  scrollLeft,
  totalTimelineWidth,
}: {
  showAllProjects: boolean
  headerGroups: HeaderGroup[]
  units: Unit[]
  unitCount: number
  zoom: Zoom
  scrollLeft: number
  totalTimelineWidth: number
}) {
  const stickyCount = showAllProjects ? 2 : 1
  return (
    <div className="shrink-0 w-full overflow-hidden border-b border-default bg-raised">
      <div className="grid text-xs text-muted" style={{ gridTemplateColumns: `${showAllProjects ? `${PROJECT_COL_WIDTH_PX}px ` : ''}${LEFT_COL_WIDTH_PX}px 1fr` }}>
        {showAllProjects ? (
          <div className="sticky left-0 z-40 bg-raised border-r border-default" style={{ height: HEADER_HEIGHT_PX }} />
        ) : null}
        <div
          className={`sticky ${showAllProjects ? '' : 'left-0'} z-30 bg-raised border-r border-default`}
          style={{
            height: HEADER_HEIGHT_PX,
            left: showAllProjects ? PROJECT_COL_WIDTH_PX : 0,
          }}
        />
        <div className="relative overflow-hidden" style={{ height: HEADER_HEIGHT_PX }}>
          <div
            className="absolute top-0 left-0 h-full"
            style={{
              width: totalTimelineWidth,
              transform: `translateX(${-scrollLeft}px)`,
              willChange: 'transform',
            }}
          >
            <div className="absolute top-0 left-0 w-full flex h-6 border-b border-subtle">
              {headerGroups.map((g, idx) => (
                <div
                  key={idx}
                  className="flex-none px-2 py-1 font-semibold text-[11px] uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{
                    width: g.len * COLUMN_WIDTH_PX,
                    borderLeft: idx > 0 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  {g.label}
                </div>
              ))}
            </div>
            <div className="absolute top-6 left-0 w-full flex h-8">
              {units.map((u, i) => {
                const isCurrentDay = zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
                return (
                  <div
                    key={u.key}
                    className={`flex-none flex flex-col items-center justify-center border-subtle ${isCurrentDay ? 'bg-accent-primary/10 text-accent-primary font-bold' : ''}`}
                    style={{
                      width: COLUMN_WIDTH_PX,
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
    </div>
  )
}

function TimelineBody({
  loading,
  labels,
  rows,
  showAllProjects,
  scrollLeft,
  totalTimelineWidth,
  units,
  unitCount,
  startAligned,
  zoom,
  openEdit,
  setHover,
  onClickStory,
  onClickFeature,
}: {
  loading: boolean
  labels: TimelineLabel[]
  rows: RowDefinition[]
  showAllProjects: boolean
  scrollLeft: number
  totalTimelineWidth: number
  units: Unit[]
  unitCount: number
  startAligned: Date
  zoom: Zoom
  openEdit: (l: TimelineLabel) => void
  setHover: (h: HoverInfo) => void
  onClickStory: (id: string) => void
  onClickFeature: (storyId: string, featureId: string) => void
}) {
  if (loading && labels.length === 0) {
    return <div className="p-4 text-sm text-muted">Loading timeline...</div>
  }

  return (
    <div className="grid pb-12" style={{ gridTemplateColumns: `${showAllProjects ? `${PROJECT_COL_WIDTH_PX}px ` : ''}${LEFT_COL_WIDTH_PX}px 1fr` }}>
      {rows.map((row, rIdx) => (
        <React.Fragment key={row.key}>
          {showAllProjects ? (
            <div
              className="sticky left-0 z-40 flex items-center bg-base border-r border-default border-b px-3"
              style={{ height: ROW_HEIGHT_PX, width: PROJECT_COL_WIDTH_PX }}
              title={row.projectTitle || ''}
            >
              <div className="text-sm font-medium text-primary truncate">{row.projectTitle || ''}</div>
            </div>
          ) : null}

          <div
            className="sticky z-30 flex items-center bg-base border-r border-default border-b px-3"
            style={{
              height: ROW_HEIGHT_PX,
              width: LEFT_COL_WIDTH_PX,
              left: showAllProjects ? PROJECT_COL_WIDTH_PX : 0,
            }}
            title={row.title}
          >
            <div className="text-sm font-medium text-primary truncate">{row.title}</div>
          </div>

          <div className="relative border-b border-subtle" style={{ height: ROW_HEIGHT_PX, overflow: 'hidden' }}>
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
              onClickFeature={onClickFeature}
              timelineWidthPx={totalTimelineWidth}
              rowHeightPx={ROW_HEIGHT_PX}
              scrollLeft={scrollLeft}
              columnWidthPx={COLUMN_WIDTH_PX}
            />
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default function ProjectTimelineView() {
  const { projectId, project } = useActiveProject()
  const { projects } = useProjectContext()
  const { storiesById } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const [labels, setLabels] = React.useState<TimelineLabel[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [isAdding, setIsAdding] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState<string>('')
  const [newDescription, setNewDescription] = React.useState<string>('')
  const [newTimestamp, setNewTimestamp] = React.useState<string>(() => new Date().toISOString().slice(0, 16))
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

  // Use a single scroller for header+body; we translate the timeline layers by scrollLeft.
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = React.useState(0)

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

  const displayedStories = React.useMemo(() => {
    if (showAllProjects) return Object.values(storiesById)
    if (!project) return []
    return project.storyIds.map((id) => storiesById[id]).filter(Boolean)
  }, [storiesById, project, showAllProjects])

  const displayedFeatures = React.useMemo(() => {
    return displayedStories
      .flatMap((t: any) =>
        (t.features || []).map((f: Feature) => ({
          ...f,
          storyProjectId: (t as any).projectId ?? projectId,
          storyId: (t as any).id,
        })),
      )
      .filter((f: any) => !!f.completedAt)
  }, [displayedStories, projectId])

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

  const headerGroups = React.useMemo(() => {
    const groups: HeaderGroup[] = []
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
    const all = buildAllProjectsRows({ projects, displayedFeatures: displayedFeatures as any[], displayedStories: displayedStories as any[] })
    return [...all, ...labelRows]
  }, [showAllProjects, featureRowSingleProject, storyRowSingleProject, labelRows, projects, displayedFeatures, displayedStories])

  const totalTimelineWidth = unitCount * COLUMN_WIDTH_PX

  const handleScroll = React.useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    setScrollLeft(el.scrollLeft)
  }, [])

  // Auto-scroll to END (rightmost) on initial load or zoom change
  React.useEffect(() => {
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
        <div className="shrink-0 p-4 m-4 border border-red-200 bg-red-50 text-red-600 rounded">{error}</div>
      ) : null}

      <div className="flex-1 min-h-0 relative flex flex-col bg-base overflow-hidden">
        <TimelineHeader
          showAllProjects={showAllProjects}
          headerGroups={headerGroups}
          units={units}
          unitCount={unitCount}
          zoom={zoom}
          scrollLeft={scrollLeft}
          totalTimelineWidth={totalTimelineWidth}
        />

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 w-full overflow-auto relative"
        >
          <TimelineBody
            loading={loading}
            labels={labels}
            rows={rows}
            showAllProjects={showAllProjects}
            scrollLeft={scrollLeft}
            totalTimelineWidth={totalTimelineWidth}
            units={units}
            unitCount={unitCount}
            startAligned={startAligned}
            zoom={zoom}
            openEdit={openEdit}
            setHover={setHover}
            onClickStory={onClickStory}
            onClickFeature={onClickFeature as any}
          />
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
