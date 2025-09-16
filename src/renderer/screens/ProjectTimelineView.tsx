import React, { useEffect, useMemo, useState } from 'react'
import { timelineService } from '../services/timelineService'
import { TimelineLabel } from '../../types/timeline'
import { Feature, Task } from 'thefactory-tools'
import { useTasks } from '../contexts/TasksContext'
import { useActiveProject } from '../contexts/ProjectContext'

function toDate(v: any): Date {
  if (!v) return new Date(NaN)
  if (v instanceof Date) return v
  return new Date(v)
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function diffInDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function uuidv4(): string {
  // RFC 4122-ish UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const DEFAULT_WINDOW_DAYS = 30
const LEFT_COL_WIDTH = '16rem'

type Zoom = 'day' | 'week' | 'month'

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
  const [newTimestamp, setNewTimestamp] = useState<string>(() => new Date().toISOString().slice(0, 16)) // yyyy-MM-ddTHH:mm
  const [scope, setScope] = useState<'project' | 'global'>('project')

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
        const fetchedFeatures = tasks
          .flatMap((t) => t.features)
          .filter((f) => !!f.completedAt)

        const fetchedProjectLabels = await timelineService
          .matchTimelineLabels({ projectId: projectId })
          .catch(() => [])
        const fetchedGlobalLabels = await timelineService
          .matchTimelineLabels({ projectId: null })
          .catch(() => [])

        const normalizeLabels = (arr: TimelineLabel[]) => (arr || []).map((l) => ({ ...l, timestamp: toDate(l.timestamp) }))

        setFeatures(fetchedFeatures)
        setLabels([...normalizeLabels(fetchedProjectLabels), ...normalizeLabels(fetchedGlobalLabels)])
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
      .filter((f) => !!(f as any).completedAt)
      .map((f) => ({ ...f, __when: toDate((f as any).completedAt) }))
    const lbs = labels.map((l) => ({ ...l, __when: toDate(l.timestamp) }))
    return [...fs, ...lbs].sort((a: any, b: any) => a.__when.getTime() - b.__when.getTime())
  }, [features, labels])

  // Determine date window
  const { startDate, endDate, days } = useMemo(() => {
    const now = new Date()
    const defaultStart = addDays(now, -DEFAULT_WINDOW_DAYS)
    const defaultEnd = addDays(now, DEFAULT_WINDOW_DAYS)

    if (timelineItems.length === 0) {
      const startDate = startOfDay(defaultStart)
      const endDate = startOfDay(defaultEnd)
      const days = diffInDays(startDate, endDate) + 1
      return { startDate, endDate, days }
    }

    const min = startOfDay(
      timelineItems.reduce((min, x: any) => (x.__when < min ? x.__when : min), timelineItems[0].__when),
    )
    const max = startOfDay(
      timelineItems.reduce((max, x: any) => (x.__when > max ? x.__when : max), timelineItems[0].__when),
    )

    const paddedStart = addDays(min, -2)
    const paddedEnd = addDays(max, 2)

    const startDate = startOfDay(paddedStart)
    const endDate = startOfDay(paddedEnd)
    const days = Math.max(1, diffInDays(startDate, endDate) + 1)
    return { startDate, endDate, days }
  }, [timelineItems])

  // Month header groups (span across day columns)
  const monthGroups = useMemo(() => {
    const groups: { label: string; startIdx: number; len: number }[] = []
    let currentLabel = ''
    let startIdx = 0
    for (let i = 0; i < days; i++) {
      const d = addDays(startDate, i)
      const lbl = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      if (i === 0) {
        currentLabel = lbl
        startIdx = 0
      } else if (lbl !== currentLabel) {
        groups.push({ label: currentLabel, startIdx, len: i - startIdx })
        currentLabel = lbl
        startIdx = i
      }
    }
    // push last
    groups.push({ label: currentLabel, startIdx, len: days - startIdx })
    return groups
  }, [startDate, days])

  // Grid column sizing based on zoom (one column per day; min width changes)
  const cellMinWidth = useMemo(() => {
    switch (zoom) {
      case 'month':
        return 20
      case 'week':
        return 40
      default:
        return 72
    }
  }, [zoom])

  const gridTemplate = useMemo(() => `${LEFT_COL_WIDTH} repeat(${days}, minmax(${cellMinWidth}px, 1fr))`, [days, cellMinWidth])

  // Build rows for features and user-defined label rows
  const featureRows = useMemo(() => {
    return [
      {
        key: 'features',
        title: 'Features (completed)',
        items: features
          .filter((f) => !!(f as any).completedAt)
          .map((f) => ({
            id: f.id,
            title: f.title,
            when: toDate((f as any).completedAt),
            kind: 'feature' as const,
          })),
      },
    ]
  }, [features])

  const labelRows = useMemo(() => {
    const groups = new Map<
      string,
      { key: string; title: string; items: { id: string; title: string; when: Date; scope: 'project' | 'global'; kind: 'label' }[] }
    >()
    for (const l of labels) {
      const title = (l.label || 'Label') as string
      const k = title
      if (!groups.has(k)) groups.set(k, { key: k, title: k, items: [] })
      groups.get(k)!.items.push({
        id: l.id,
        title: l.description || l.label,
        when: toDate(l.timestamp),
        scope: l.projectId ? 'project' : 'global',
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
      const input: TimelineLabel = {
        id: uuidv4(),
        projectId: scope === 'project' ? projectId : null,
        timestamp: new Date(newTimestamp),
        label: newLabel.trim() || 'Label',
        description: newDescription.trim() || undefined,
      }
      const created = await timelineService.addTimelineLabel(input)
      const normalized: TimelineLabel = { ...created, timestamp: toDate(created.timestamp) }
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
    const todayIdx = Math.max(0, Math.min(days - 1, diffInDays(startDate, new Date())))
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
                  (zoom === z ? 'bg-accent-primary text-inverted' : 'bg-raised text-secondary hover:text-primary')
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
        <form onSubmit={onAddLabel} className="px-4 pt-3 pb-2 grid gap-2 sm:grid-cols-5 items-end bg-base border-b border-subtle">
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
              <option value="global">All projects (global)</option>
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
            {/* Header: months (group) + days */}
            <div className="sticky top-[var(--header-offset,0px)] z-10 bg-base">
              {/* Months row */}
              <div className="grid border-b border-subtle" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-10 bg-base px-3 py-2 text-sm font-medium text-primary flex items-center">
                  Rows
                </div>
                {monthGroups.map((g, idx) => (
                  <div
                    key={`m-${idx}`}
                    className="px-2 py-2 text-xs text-secondary border-l border-subtle flex items-center"
                    style={{ gridColumnStart: 2 + g.startIdx, gridColumnEnd: `span ${g.len}` }}
                  >
                    {g.label}
                  </div>
                ))}
              </div>
              {/* Days row */}
              <div className="grid bg-raised/50 border-b border-subtle" style={{ gridTemplateColumns: gridTemplate }}>
                <div className="sticky left-0 z-10 bg-base px-3 py-2 text-xs font-medium text-secondary flex items-center">
                  
                </div>
                {Array.from({ length: days }).map((_, i) => {
                  const d = addDays(startDate, i)
                  const label = d.toLocaleDateString(undefined, { day: 'numeric' })
                  const dow = d.toLocaleDateString(undefined, { weekday: 'narrow' })
                  const isToday = startOfDay(d).getTime() === startOfDay(new Date()).getTime()
                  return (
                    <div
                      key={`h-${i}`}
                      className={`px-2 py-1.5 text-[11px] leading-4 text-secondary border-l border-subtle flex flex-col items-start ${
                        isToday ? 'bg-status-review-soft-bg/30' : ''
                      }`}
                    >
                      <span className="font-medium text-primary">{label}</span>
                      <span>{dow}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Rows */}
            {allRows.map((row, rowIdx) => (
              <div key={row.key} className="relative">
                <div className="grid relative items-center" style={{ gridTemplateColumns: gridTemplate }}>
                  {/* Row label */}
                  <div className="sticky left-0 z-10 h-12 bg-base px-3 text-sm font-medium text-primary flex items-center border-b border-subtle">
                    {row.title}
                  </div>
                  {/* Grid cells background */}
                  {Array.from({ length: days }).map((_, i) => (
                    <div key={`c-${row.key}-${i}`} className="h-12 border-l border-b border-subtle" />
                  ))}

                  {/* Items */}
                  {row.items.map((it) => {
                    const idx = Math.max(0, Math.min(days - 1, diffInDays(startDate, it.when)))
                    const colStart = 2 + idx
                    const isFeature = (it as any).kind === 'feature'

                    const pillBase =
                      'pointer-events-auto mx-1 rounded-md px-2 py-1 text-xs shadow-sm border whitespace-nowrap max-w-[12rem]'
                    const featureStyles = 'bg-status-done-soft-bg text-status-done-soft-fg border-status-done-soft-border'
                    const labelProjectStyles = 'bg-status-review-soft-bg text-status-review-soft-fg border-status-review-soft-border'
                    const labelGlobalStyles = 'bg-status-on_hold-soft-bg text-status-on_hold-soft-fg border-status-on_hold-soft-border'

                    const className = `${pillBase} ${
                      isFeature ? featureStyles : (it as any).scope === 'project' ? labelProjectStyles : labelGlobalStyles
                    }`

                    return (
                      <div
                        key={it.id}
                        className={className}
                        style={{ gridColumnStart: colStart, gridColumnEnd: `span 1`, alignSelf: 'center' as any }}
                        title={`${it.title}\n${it.when.toLocaleString()}`}
                      >
                        <div className="truncate font-medium">{it.title}</div>
                        <div className="opacity-80 text-[10px]">{it.when.toLocaleDateString()}</div>
                      </div>
                    )
                  })}
                </div>

                {/* Today marker line */}
                {(() => {
                  const idx = Math.max(0, Math.min(days - 1, diffInDays(startDate, new Date())))
                  const colStart = 2 + idx
                  return (
                    <div
                      className="pointer-events-none absolute inset-y-0"
                      style={{ gridArea: '1 / 1 / 1 / 1' }}
                    >
                      <div
                        className="absolute inset-y-0 w-0.5 bg-accent-primary/60"
                        style={{ left: `calc(${LEFT_COL_WIDTH} + ${(idx + 0.5) * Math.max(cellMinWidth, 1)}px)` }}
                        aria-hidden
                      />
                    </div>
                  )
                })()}
              </div>
            ))}

            {allRows.length === 0 && (
              <div className="p-6 text-sm text-secondary">No timeline items yet. Add your first label above.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
