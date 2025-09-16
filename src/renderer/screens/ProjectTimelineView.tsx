import React, { useEffect, useMemo, useState } from 'react'
import { Feature, Task } from 'thefactory-tools'
import { useTasks } from '../contexts/TasksContext'
import { useActiveProject } from '../contexts/ProjectContext'
import { dbService } from '../services/dbService'
import { Entity } from 'thefactory-db'
import { EntityInput } from 'thefactory-db/dist/types'

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

export default function ProjectTimelineView() {
  const { projectId } = useActiveProject()
  const { tasksById } = useTasks()

  const [features, setFeatures] = useState<Feature[]>([])
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

  // Zoom state (Notion/Airtable-like)
  const [zoom, setZoom] = useState<Zoom>('day')

  useEffect(() => {
    if (!projectId) {
      setError('Project ID is missing.')
      setLoading(false)
      return
    }

    const fetchTimelineData = async () => {
      setLoading(true)
      setError(null)
      try {
        const tasks: Task[] = Object.values(tasksById)
        const fetchedFeatures = tasks.flatMap((t) => t.features).filter((f) => !!f.completedAt)

        const fetchedProjectLabels = await dbService.matchEntities(undefined, {
          projectIds: [projectId],
          types: [ENTITY_TYPE],
        })
        const fetchedGlobalLabels = (
          await dbService.matchEntities(undefined, {
            types: [ENTITY_TYPE],
          })
        ).filter((l) => l.projectId !== projectId)

        setFeatures(fetchedFeatures)
        setLabels([
          ...normalizeLabels(fetchedProjectLabels),
          ...normalizeLabels(fetchedGlobalLabels),
        ])
      } catch (err: any) {
        console.error('Failed to fetch timeline data:', err)
        setError(err?.message || 'An unknown error occurred while fetching timeline data.')
      } finally {
        setLoading(false)
      }
    }

    fetchTimelineData()
  }, [projectId, tasksById])

  const timelineItems = useMemo(() => {
    const fs = features
      .filter((f) => f.completedAt)
      .map((f) => mapFeatureToTimelineLabel(projectId, f))
    return [...fs, ...labels].sort(
      (a, b) => new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime(),
    )
  }, [features, labels])

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

  // Build rows for features and user-defined label rows
  const featureRows = useMemo(() => {
    return [
      {
        key: 'features',
        title: 'Features (completed)',
        items: features
          .filter((f) => f.completedAt)
          .map((f) => ({
            id: f.id,
            title: f.title,
            timestamp: f.completedAt ?? new Date().toISOString(),
            kind: 'feature' as const,
          })),
      },
    ]
  }, [features])

  const labelRows = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string
        title: string
        items: {
          id: string
          title: string
          timestamp: string
          scope: 'project' | '__global__'
          kind: 'label'
        }[]
      }
    >()
    for (const l of labels) {
      const title = l.content.label
      const k = title
      if (!groups.has(k)) groups.set(k, { key: k, title: k, items: [] })
      groups.get(k)!.items.push({
        id: l.id,
        title,
        timestamp: l.content.timestamp,
        scope: l.projectId ? 'project' : '__global__',
        kind: 'label',
      })
    }
    return Array.from(groups.values()).sort((a, b) => a.title.localeCompare(b.title))
  }, [labels])

  const allRows = useMemo(() => {
    return [...featureRows, ...labelRows]
  }, [featureRows, labelRows])

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

  const scrollToToday = () => {
    const container = document.getElementById('project-timeline-scroll')
    if (!container) return
    let todayIdx = 0
    if (zoom === 'day') todayIdx = clamp(diffInDays(startAligned, new Date()), 0, unitCount - 1)
    else if (zoom === 'week')
      todayIdx = clamp(diffInWeeks(startAligned, new Date()), 0, unitCount - 1)
    else todayIdx = clamp(diffInMonths(startAligned, new Date()), 0, unitCount - 1)
    const approxCell = cellMinWidth
    container.scrollTo({ left: todayIdx * approxCell, behavior: 'smooth' })
  }

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
        <div className="flex items-center gap-2">
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
              >
                <div className="sticky left-0 z-10 bg-base px-3 py-2 text-xs font-medium text-secondary flex items-center"></div>
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
                <div
                  className="grid relative items-center"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {/* Row label */}
                  <div className="sticky left-0 z-10 h-12 bg-base px-3 text-sm font-medium text-primary flex items-center border-b border-subtle">
                    {row.title}
                  </div>
                  {/* Grid cells background */}
                  {Array.from({ length: unitCount }).map((_, i) => (
                    <div
                      key={`c-${row.key}-${i}`}
                      className="h-12 border-l border-b border-subtle"
                    />
                  ))}

                  {/* Items */}
                  {row.items.map((it) => {
                    let idx = 0
                    if (zoom === 'day')
                      idx = clamp(
                        diffInDays(startAligned, new Date(it.timestamp)),
                        0,
                        unitCount - 1,
                      )
                    else if (zoom === 'week')
                      idx = clamp(
                        diffInWeeks(startAligned, new Date(it.timestamp)),
                        0,
                        unitCount - 1,
                      )
                    else
                      idx = clamp(
                        diffInMonths(startAligned, new Date(it.timestamp)),
                        0,
                        unitCount - 1,
                      )

                    const colStart = 2 + idx
                    const isFeature = (it as any).kind === 'feature'

                    const pillBase =
                      'pointer-events-auto mx-1 rounded-md px-2 py-1 text-xs shadow-sm border whitespace-nowrap max-w-[12rem]'
                    const featureStyles =
                      'bg-status-done-soft-bg text-status-done-soft-fg border-status-done-soft-border'
                    const labelProjectStyles =
                      'bg-status-review-soft-bg text-status-review-soft-fg border-status-review-soft-border'
                    const labelGlobalStyles =
                      'bg-status-on_hold-soft-bg text-status-on_hold-soft-fg border-status-on_hold-soft-border'

                    const className = `${pillBase} ${
                      isFeature
                        ? featureStyles
                        : (it as any).scope === 'project'
                          ? labelProjectStyles
                          : labelGlobalStyles
                    }`

                    return (
                      <div
                        key={it.id}
                        className={className}
                        style={{
                          gridColumnStart: colStart,
                          gridColumnEnd: `span 1`,
                          alignSelf: 'center' as any,
                        }}
                        title={`${it.title}\n${new Date(it.timestamp).toLocaleString()}`}
                      >
                        <div className="truncate font-medium">{it.title}</div>
                        <div className="opacity-80 text-[10px]">
                          {new Date(it.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    )
                  })}
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
