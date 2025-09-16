import React, { useEffect, useMemo, useState } from 'react'
import { timelineService } from '../services/timelineService'
import { TimelineLabel } from '../../types/timeline'
import { Feature, Task } from 'thefactory-tools'
import { useTasks } from '../contexts/TasksContext'
import { useActiveProject } from '../contexts/ProjectContext'

function isTimelineLabel(x: any): x is TimelineLabel {
  return x && typeof x === 'object' && 'timestamp' in x && x.timestamp != null
}

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
          .filter((f) => !!f.completedAt) // only completed features

        const fetchedProjectLabels = await timelineService
          .matchTimelineLabels({ projectId: projectId })
          .catch(() => [])
        const fetchedGlobalLabels = await timelineService
          .matchTimelineLabels({ projectId: null })
          .catch(() => [])

        // Normalize label timestamps to Date
        const normalizeLabels = (arr: TimelineLabel[]) =>
          (arr || []).map((l) => ({ ...l, timestamp: toDate(l.timestamp) }))

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
      .filter((f) => !!f.completedAt)
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

  const gridTemplate = useMemo(() => `12rem repeat(${days}, minmax(80px, 1fr))`, [days])

  // Build rows
  const featureRows = useMemo(() => {
    return [
      {
        key: 'features',
        title: 'Features (completed)',
        items: features
          .filter((f) => !!f.completedAt)
          .map((f) => ({
            id: f.id,
            title: f.title,
            when: toDate((f as any).completedAt),
          })),
      },
    ]
  }, [features])

  const labelRows = useMemo(() => {
    // Group labels by their label value (acts as user-defined row name)
    const groups = new Map<string, { key: string; title: string; items: { id: string; title: string; when: Date; scope: 'project' | 'global' }[] }>()
    for (const l of labels) {
      const title = (l.label || 'Label') as string
      const k = title
      if (!groups.has(k)) groups.set(k, { key: k, title: k, items: [] })
      groups.get(k)!.items.push({
        id: l.id,
        title: l.description || l.label,
        when: toDate(l.timestamp),
        scope: l.projectId ? 'project' : 'global',
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

  if (loading) {
    return <div className="p-4 text-neutral-500">Loading timeline...</div>
  }

  return (
    <div className="h-full overflow-auto p-4" id="project-timeline-view">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Project timeline</h2>
          <div className="text-xs text-neutral-500">Project: {projectId}</div>
        </div>
        <div className="flex items-center gap-2">
          {error && <div className="text-xs text-red-500">{error}</div>}
          {!isAdding ? (
            <button
              className="btn-primary px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => setIsAdding(true)}
            >
              + Add label
            </button>
          ) : (
            <button
              className="px-3 py-1.5 text-sm rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setIsAdding(false)}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <form onSubmit={onAddLabel} className="mb-4 grid gap-2 sm:grid-cols-5 items-end">
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-neutral-500">Row label</label>
            <input
              className="h-9 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Milestone A"
              required
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-xs text-neutral-500">Description (optional)</label>
            <input
              className="h-9 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short note"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-neutral-500">When</label>
            <input
              type="datetime-local"
              className="h-9 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-1">
            <label className="text-xs text-neutral-500">Scope</label>
            <select
              className="h-9 rounded border border-neutral-300 bg-white px-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
              className="btn-primary px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save label
            </button>
          </div>
        </form>
      )}

      <div className="overflow-auto rounded border border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div
          className="sticky top-0 z-10 grid bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          <div className="sticky left-0 z-10 bg-neutral-50 px-3 py-2 text-sm font-medium dark:bg-neutral-900">
            Rows
          </div>
          {Array.from({ length: days }).map((_, i) => {
            const d = addDays(startDate, i)
            const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            return (
              <div
                key={`h-${i}`}
                className="px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400 border-l border-neutral-200 dark:border-neutral-800"
              >
                {label}
              </div>
            )
          })}
        </div>

        {/* Body rows */}
        {allRows.map((row) => (
          <div
            key={row.key}
            className="grid relative h-14 items-center"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {/* Row label */}
            <div className="sticky left-0 z-10 h-full bg-white px-3 text-sm font-medium dark:bg-neutral-900 flex items-center border-b border-neutral-200 dark:border-neutral-800">
              {row.title}
            </div>
            {/* Grid cells background */}
            {Array.from({ length: days }).map((_, i) => (
              <div
                key={`c-${row.key}-${i}`}
                className="h-full border-l border-b border-neutral-200 dark:border-neutral-800"
              />
            ))}
            {/* Items */}
            {row.items.map((it) => {
              const idx = Math.max(0, Math.min(days - 1, diffInDays(startDate, it.when)))
              const colStart = 2 + idx // +1 for row label col, +1 because grid is 1-based
              return (
                <div
                  key={it.id}
                  className="pointer-events-auto mx-1 rounded bg-blue-600/90 px-2 py-1 text-xs text-white shadow-sm"
                  style={{ gridColumnStart: colStart, gridColumnEnd: `span 1` }}
                  title={`${it.title}\n${it.when.toLocaleString()}`}
                >
                  <div className="truncate">{it.title}</div>
                  <div className="opacity-80">{it.when.toLocaleDateString()}</div>
                </div>
              )
            })}
          </div>
        ))}

        {allRows.length === 0 && (
          <div className="p-4 text-sm text-neutral-500">No timeline items yet. Add your first label above.</div>
        )}
      </div>
    </div>
  )
}
