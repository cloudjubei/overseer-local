import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useActiveProject, useProjects } from '@core/contexts/ProjectsContext'
import { useStories } from '@core/contexts/StoriesContext'
import {
  createEntity,
  deleteEntity,
  listEntities,
  listStories,
  updateEntity,
  type Entity,
  type Feature,
  type GetStoryResponse,
} from 'thefactory-ui/headless/api'
import {
  Alert,
  Button,
  Field,
  Input,
  Modal,
  NativeSelect,
  SegmentedControl,
  Switch,
} from 'thefactory-ui/web'
import { IconSave } from 'thefactory-ui/web/icons'

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
const LEFT_COL_WIDTH_PX = 96
const PROJECT_COL_WIDTH_PX = 88
const YEAR_STRIP_HEIGHT_PX = 22
const DATE_STRIP_HEIGHT_PX = HEADER_HEIGHT_PX - YEAR_STRIP_HEIGHT_PX
const STORY_COUNT_COLOR = 'bg-emerald-200 border-emerald-500'
const FEATURE_COUNT_COLOR = 'bg-purple-200 border-purple-500'

type HeaderGroup = { label: string; startIdx: number; len: number }
type YearStripGroup = HeaderGroup & { leftPx: number; widthPx: number }

type StoryWithProject = GetStoryResponse & { projectId: string }
type FeatureWithStory = Feature & {
  storyId: string
  storyProjectId: string
}

export default function ProjectTimelineView() {
  const navigate = useNavigate()
  const { projectId, project } = useActiveProject()
  const { projects } = useProjects()
  const { stories: activeProjectStories } = useStories()

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

  // All-projects mode loads every project's stories ad-hoc — the
  // `StoriesContext` only tracks the active project's set.
  const [allProjectsStories, setAllProjectsStories] = React.useState<StoryWithProject[]>([])
  const [loadingAllProjects, setLoadingAllProjects] = React.useState(false)

  const rightScrollRef = React.useRef<HTMLDivElement>(null)
  const leftScrollRef = React.useRef<HTMLDivElement>(null)
  const yearStripRef = React.useRef<HTMLDivElement>(null)

  const hasInitialAutoScrolledRef = React.useRef(false)
  const prevZoomRef = React.useRef<Zoom>('day')
  const prevProjectIdRef = React.useRef(projectId)
  const prevShowAllProjectsRef = React.useRef(false)

  React.useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      hasInitialAutoScrolledRef.current = false
      setShowAllProjects(false)
      prevProjectIdRef.current = projectId
    }
  }, [projectId])

  // Fetch stories across all projects when the toggle flips on.
  React.useEffect(() => {
    if (!showAllProjects) {
      setAllProjectsStories([])
      return
    }
    let cancelled = false
    const run = async () => {
      setLoadingAllProjects(true)
      try {
        const results = await Promise.all(
          projects.map(async (p) => {
            try {
              const { data } = await listStories({
                path: { projectId: p.id },
                throwOnError: true,
              })
              return data.map((s) => ({ ...s, projectId: p.id }) as StoryWithProject)
            } catch {
              return [] as StoryWithProject[]
            }
          }),
        )
        if (!cancelled) setAllProjectsStories(results.flat())
      } finally {
        if (!cancelled) setLoadingAllProjects(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [showAllProjects, projects])

  const displayedStories = React.useMemo<StoryWithProject[]>(() => {
    if (showAllProjects) return allProjectsStories
    if (!project) return []
    return activeProjectStories.map((s) => ({ ...s, projectId: project.id }))
  }, [showAllProjects, allProjectsStories, project, activeProjectStories])

  const storiesById = React.useMemo<Record<string, StoryWithProject>>(() => {
    const out: Record<string, StoryWithProject> = {}
    for (const s of displayedStories) out[s.id] = s
    return out
  }, [displayedStories])

  const displayedFeatures = React.useMemo<FeatureWithStory[]>(() => {
    return displayedStories
      .flatMap((s) =>
        (s.features || []).map(
          (f) =>
            ({
              ...f,
              storyId: s.id,
              storyProjectId: s.projectId,
            }) as FeatureWithStory,
        ),
      )
      .filter((f) => !!f.completedAt)
  }, [displayedStories])

  // Fetch timeline labels (entities) — by project + global, or globally
  // when showAllProjects is on.
  React.useEffect(() => {
    if (!projectId && !showAllProjects) {
      setError('Project ID is missing.')
      setLoading(false)
      return
    }
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        let fetchedLabels: Entity[] = []
        if (showAllProjects) {
          const { data } = await listEntities({
            query: { types: ENTITY_TYPE },
            throwOnError: true,
          })
          fetchedLabels = data
        } else {
          const projectLabelsPromise = projectId
            ? listEntities({
                query: { types: ENTITY_TYPE, projectIds: projectId },
                throwOnError: true,
              }).then((r) => r.data)
            : Promise.resolve([] as Entity[])
          const globalLabelsPromise = listEntities({
            query: { types: ENTITY_TYPE, projectIds: '__global__' },
            throwOnError: true,
          }).then((r) => r.data)
          const [projectLabels, globalLabels] = await Promise.all([
            projectLabelsPromise,
            globalLabelsPromise,
          ])
          fetchedLabels = [...projectLabels, ...globalLabels]
        }
        if (!cancelled) setLabels(normalizeLabels(fetchedLabels))
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load timeline labels.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [projectId, showAllProjects])

  const timelineItems = React.useMemo(() => {
    const fs = displayedFeatures.map((f) => mapFeatureToTimelineLabel(f.storyProjectId, f))
    const ts = displayedStories
      .map((s) => mapStoryToTimelineLabel(s.projectId ?? projectId ?? 'noproj', s))
      .filter((x): x is TimelineLabel => !!x)
    return [...fs, ...ts, ...labels].sort(
      (a, b) => new Date(a.content.timestamp).getTime() - new Date(b.content.timestamp).getTime(),
    )
  }, [displayedFeatures, displayedStories, labels, projectId])

  const { rawStartDate, rawEndDate } = React.useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)
    const defaultStart = startOfDay(addDays(now, -DEFAULT_WINDOW_DAYS))
    if (timelineItems.length === 0) {
      return { rawStartDate: defaultStart, rawEndDate: today }
    }
    const first = new Date(timelineItems[0].content.timestamp)
    const itemsMin = startOfDay(
      timelineItems.reduce(
        (acc, x) => (new Date(x.content.timestamp) < acc ? new Date(x.content.timestamp) : acc),
        first,
      ),
    )
    const itemsMax = startOfDay(
      timelineItems.reduce(
        (acc, x) => (new Date(x.content.timestamp) > acc ? new Date(x.content.timestamp) : acc),
        first,
      ),
    )
    // Always include today on the right edge so the user can see the
    // current date even when all items are in the past.
    const min = itemsMin < defaultStart ? itemsMin : defaultStart
    const max = itemsMax > today ? itemsMax : today
    return { rawStartDate: min, rawEndDate: max }
  }, [timelineItems])

  const { units, unitCount, startAligned } = React.useMemo(() => {
    const arr: Unit[] = []
    let start: Date

    if (zoom === 'day') {
      const paddedStart = addDays(rawStartDate, -2)
      const paddedEnd = addDays(rawEndDate, 2)
      start = startOfDay(paddedStart)
      const end = startOfDay(paddedEnd)
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
      const end = startOfWeek(paddedEnd)
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
    const end = startOfMonth(paddedEnd)
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

  const headerGroups = React.useMemo<HeaderGroup[]>(() => {
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
  }, [units])

  const featureRowSingleProject = React.useMemo<RowDefinition>(() => {
    const items = displayedFeatures.map((f) => ({
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
      .map((s) => {
        const ts = getStoryCompletedAt(s)
        if (!ts) return null
        return {
          id: s.id,
          title: s.title,
          timestamp: ts,
          kind: 'story' as const,
          projectId: s.projectId,
        }
      })
      .filter(Boolean) as RowDefinition['items']
    return { key: 'stories', title: 'Stories', items }
  }, [displayedStories])

  const labelRows = React.useMemo(() => buildLabelRows(labels, projectId), [labels, projectId])

  const rows = React.useMemo<RowDefinition[]>(() => {
    if (!showAllProjects) return [featureRowSingleProject, storyRowSingleProject, ...labelRows]
    const all = buildAllProjectsRows({
      projects,
      displayedFeatures,
      displayedStories,
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
    for (const story of displayedStories) {
      const ts = getStoryCompletedAt(story)
      if (!ts) continue
      const key = bucketKey(new Date(ts))
      if (out[key]) out[key].stories += 1
    }
    for (const feature of displayedFeatures) {
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

  /**
   * Compute the pixel offset of a given date inside the timeline scroll
   * area. Used by initial auto-scroll, the Today button, and the
   * "scroll to where the label was added" behaviour.
   */
  const scrollLeftForDate = React.useCallback(
    (target: Date): number => {
      const idx =
        zoom === 'day'
          ? diffInDays(startAligned, target)
          : zoom === 'week'
            ? diffInWeeks(startAligned, target)
            : diffInMonths(startAligned, target)
      const clamped = Math.max(0, Math.min(unitCount - 1, idx))
      return clamped * COLUMN_WIDTH_PX
    },
    [zoom, startAligned, unitCount],
  )

  const scrollToDate = React.useCallback(
    (target: Date, behavior: ScrollBehavior = 'auto') => {
      const el = rightScrollRef.current
      if (!el) return
      const colLeft = scrollLeftForDate(target)
      const center = Math.max(0, colLeft - el.clientWidth / 2 + COLUMN_WIDTH_PX / 2)
      el.scrollTo({ left: center, behavior })
    },
    [scrollLeftForDate],
  )

  const scrollToToday = React.useCallback(
    (behavior: ScrollBehavior = 'auto') => scrollToDate(new Date(), behavior),
    [scrollToDate],
  )

  // Auto-scroll to today on initial load, on zoom change, and whenever the
  // user toggles All Projects. No animation — the timeline should always
  // _start_ on today's date. We wait for the data to actually settle so the
  // scroll lands against the *new* unit list, never the old one:
  //   - labels fetch (`loading`) is done
  //   - going to All Projects: cross-project story fetch
  //     (`loadingAllProjects`) is done AND at least one project's stories
  //     have landed
  //   - going back to a single project: the `allProjectsStories` buffer has
  //     been cleared so `units` no longer reflects the wider date range
  React.useEffect(() => {
    if (loading || units.length === 0) return
    if (showAllProjects) {
      if (loadingAllProjects || allProjectsStories.length === 0) return
    } else {
      if (allProjectsStories.length > 0) return
    }
    const showAllChanged = prevShowAllProjectsRef.current !== showAllProjects
    if (!hasInitialAutoScrolledRef.current || prevZoomRef.current !== zoom || showAllChanged) {
      requestAnimationFrame(() => {
        scrollToToday('auto')
        hasInitialAutoScrolledRef.current = true
        prevZoomRef.current = zoom
        prevShowAllProjectsRef.current = showAllProjects
      })
    }
  }, [
    loading,
    loadingAllProjects,
    allProjectsStories.length,
    units.length,
    zoom,
    showAllProjects,
    scrollToToday,
  ])

  const onAddLabel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    const timestampIso = new Date(newTimestamp).toISOString()
    try {
      // No global loading state here — the right pane stays mounted and the
      // user keeps their scroll position. After the new label lands we
      // scroll to its date column instead of resetting to today.
      const { data } = await createEntity({
        body: {
          projectId: scope === '__global__' ? '__global__' : (projectId ?? 'noproj'),
          type: ENTITY_TYPE,
          content: {
            timestamp: timestampIso,
            label: newLabel.trim(),
            description: newDescription.trim() || undefined,
          },
        },
        throwOnError: true,
      })
      setLabels((prev) => [...prev, normalizeLabels([data])[0]])
      setIsAdding(false)
      setNewLabel('')
      setNewDescription('')
      // Wait a frame so the new column is laid out before scrolling.
      requestAnimationFrame(() => scrollToDate(new Date(timestampIso), 'auto'))
    } catch (err) {
      window.alert(`Failed to create label: ${err instanceof Error ? err.message : String(err)}`)
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
      const target = labels.find((l) => l.id === editingId)
      const currentScope = target?.projectId === '__global__' ? '__global__' : 'project'
      const scopeChanged = editScope !== currentScope
      const desiredProjectId = editScope === '__global__' ? '__global__' : (projectId ?? 'noproj')
      const nextContent = {
        ...((target?.content ?? {}) as Record<string, unknown>),
        timestamp: new Date(editTimestamp).toISOString(),
        label: editLabel.trim(),
        description: editDescription.trim() || undefined,
      }

      if (scopeChanged) {
        // The update endpoint doesn't accept `projectId` — recreate the
        // entity under the new scope and delete the old one to move it.
        await deleteEntity({ path: { id: editingId }, throwOnError: true })
        const { data } = await createEntity({
          body: {
            projectId: desiredProjectId,
            type: ENTITY_TYPE,
            content: nextContent,
          },
          throwOnError: true,
        })
        setLabels((prev) => [...prev.filter((x) => x.id !== editingId), normalizeLabels([data])[0]])
      } else {
        const { data } = await updateEntity({
          path: { id: editingId },
          body: { content: nextContent },
          throwOnError: true,
        })
        setLabels((prev) => prev.map((x) => (x.id === editingId ? normalizeLabels([data])[0] : x)))
      }
      closeEdit()
    } catch (err) {
      window.alert(`Failed to save edit: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const onDeleteEdit = async () => {
    if (!editingId) return
    if (!window.confirm('Are you sure you want to delete this timeline label?')) return
    setSavingEdit(true)
    try {
      await deleteEntity({ path: { id: editingId }, throwOnError: true })
      setLabels((prev) => prev.filter((x) => x.id !== editingId))
      closeEdit()
    } catch (err) {
      window.alert(`Failed to delete: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingEdit(false)
    }
  }

  const onClickStory = (storyId: string) => {
    const id = storyId.replace(/^story-/, '')
    if (projectId) navigate(`/projects/${projectId}/stories/${id}`)
  }
  const onClickFeature = (storyId: string) => {
    if (projectId) navigate(`/projects/${projectId}/stories/${storyId}`)
  }

  const totalLoading = loading || loadingAllProjects

  return (
    <div className="flex flex-col h-full overflow-hidden bg-(--surface-base) text-(--text-primary)">
      <TimelineToolbar
        zoom={zoom}
        setZoom={setZoom}
        onToday={() => scrollToToday('smooth')}
        showAllProjects={showAllProjects}
        setShowAllProjects={setShowAllProjects}
        isAdding={isAdding}
        setIsAdding={setIsAdding}
      />

      {isAdding && (
        <AddLabelForm
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
      )}

      {error && (
        <div className="shrink-0 m-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <div className="flex-1 min-h-0 relative flex bg-(--surface-base) overflow-hidden">
        {/* LEFT PANE */}
        <div
          className="flex flex-col shrink-0 border-r z-30 shadow-sm bg-(--surface-base)"
          style={{
            width: (showAllProjects ? PROJECT_COL_WIDTH_PX : 0) + LEFT_COL_WIDTH_PX,
            borderColor: 'var(--border-subtle)',
          }}
        >
          {/* Top-left header cell — mirrors the right-pane blue header */}
          <div
            className="shrink-0 flex items-center justify-between px-2 border-b bg-blue-50 dark:bg-blue-900/30"
            style={{ height: HEADER_HEIGHT_PX, borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-1.5 cursor-default" title="Features">
              <span className="w-2.5 h-2.5 rounded-xs bg-purple-200 border border-purple-500" />
              <span className="font-medium text-xs">{displayedFeatures.length}</span>
            </div>
            <div className="flex items-center gap-1.5 cursor-default" title="Stories">
              <span className="font-medium text-xs">{displayedStories.length}</span>
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-200 border border-emerald-500" />
            </div>
          </div>

          {/* Left body cells */}
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
                  className="flex border-b bg-(--surface-base)"
                  style={{ height: ROW_HEIGHT_PX, borderColor: 'var(--border-subtle)' }}
                >
                  {showAllProjects && (
                    <div
                      className="shrink-0 flex items-center justify-center p-2 border-r overflow-hidden"
                      style={{
                        width: PROJECT_COL_WIDTH_PX,
                        borderColor: 'var(--border-subtle)',
                      }}
                      title={row.projectTitle || ''}
                    >
                      <span className="text-[11px] leading-tight font-medium text-center wrap-break-word overflow-hidden">
                        {row.projectTitle || ''}
                      </span>
                    </div>
                  )}
                  <div
                    className="flex-1 flex flex-col justify-center items-center p-2 min-w-0"
                    title={row.title}
                  >
                    <span className="text-[11px] leading-tight font-medium text-center wrap-break-word overflow-hidden mb-2">
                      {row.title}
                    </span>
                    {(row.key.endsWith('-features') || row.key === 'features') && (
                      <div className="flex items-center gap-1.5" title="Features in this row">
                        <span className="w-2 h-2 rounded-xs bg-purple-200 border border-purple-500" />
                        <span className="text-[10px] font-medium text-(--text-secondary)">
                          {row.items.length}
                        </span>
                      </div>
                    )}
                    {(row.key.endsWith('-stories') || row.key === 'stories') && (
                      <div className="flex items-center gap-1.5" title="Stories in this row">
                        <span className="w-2 h-2 rounded-xs bg-emerald-200 border border-emerald-500" />
                        <span className="text-[10px] font-medium text-(--text-secondary)">
                          {row.items.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANE */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Year strip — sticky overlay above the date strip */}
          <div
            className="absolute top-0 left-0 right-0 overflow-hidden border-b z-50 pointer-events-none bg-blue-50 dark:bg-blue-900/30"
            style={{
              height: YEAR_STRIP_HEIGHT_PX,
              borderColor: 'var(--border-subtle)',
            }}
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
                      {visibleWidth > 0 && (
                        <span
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 px-2 py-1 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap"
                          style={{
                            left: labelLeft,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {g.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto" ref={rightScrollRef} onScroll={handleRightScroll}>
            {totalLoading && labels.length === 0 ? (
              <div className="p-4 text-sm text-(--text-secondary)">Loading timeline…</div>
            ) : (
              <div style={{ width: totalTimelineWidth }}>
                {/* Sticky date strip */}
                <div
                  className="sticky top-0 border-b z-40 overflow-hidden bg-blue-50 dark:bg-blue-900/30"
                  style={{
                    height: HEADER_HEIGHT_PX,
                    minHeight: HEADER_HEIGHT_PX,
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div
                    className="absolute left-0 w-full flex"
                    style={{
                      top: YEAR_STRIP_HEIGHT_PX,
                      height: DATE_STRIP_HEIGHT_PX,
                      minHeight: DATE_STRIP_HEIGHT_PX,
                    }}
                  >
                    {units.map((u, i) => {
                      const isCurrentDay =
                        zoom === 'day' && diffInDays(u.start, startOfDay(new Date())) === 0
                      const counts = countsByUnit[u.key] || { stories: 0, features: 0 }
                      return (
                        <div
                          key={u.key}
                          className="flex-none flex items-center justify-between gap-2 px-2"
                          style={{
                            width: COLUMN_WIDTH_PX,
                            borderLeft: i > 0 ? '1px solid var(--border-subtle)' : 'none',
                            background: isCurrentDay
                              ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)'
                              : 'transparent',
                            color: isCurrentDay ? 'var(--accent-primary)' : undefined,
                            fontWeight: isCurrentDay ? 700 : undefined,
                          }}
                        >
                          <div className="flex items-center gap-1 min-w-0" title="Stories">
                            <span className="text-[10px] leading-none">{counts.stories}</span>
                            <span
                              className={`w-2.5 h-2.5 rounded-xs border ${STORY_COUNT_COLOR}`}
                            />
                          </div>
                          <div className="min-w-0 text-center flex-1">
                            <div className="text-[11px] leading-tight truncate">{u.labelTop}</div>
                            {u.labelBottom && (
                              <div className="text-[9px] opacity-75 truncate">{u.labelBottom}</div>
                            )}
                          </div>
                          <div
                            className="flex items-center gap-1 min-w-0 justify-end"
                            title="Features"
                          >
                            <span
                              className={`w-2.5 h-2.5 rounded-xs border ${FEATURE_COUNT_COLOR}`}
                            />
                            <span className="text-[10px] leading-none">{counts.features}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Rows */}
                <div className="pb-12">
                  {rows.map((row) => (
                    <div
                      key={row.key}
                      className="relative border-b bg-(--surface-base)"
                      style={{
                        height: ROW_HEIGHT_PX,
                        overflow: 'hidden',
                        borderColor: 'var(--border-subtle)',
                      }}
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
                        onClickFeature={onClickFeature}
                        timelineWidthPx={totalTimelineWidth}
                        rowHeightPx={ROW_HEIGHT_PX}
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

      <TimelineHoverCard hover={hover} storiesById={storiesById} />

      {editingId && (
        <Modal isOpen onClose={closeEdit} title="Edit timeline label" size="lg">
          <form onSubmit={onSaveEdit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-5 items-end">
              <div className="sm:col-span-2">
                <Field label="Row label">
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="e.g. Milestone A"
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Description (optional)">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Short note"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="When">
                  <Input
                    type="datetime-local"
                    value={editTimestamp}
                    onChange={(e) => setEditTimestamp(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Scope">
                  <NativeSelect
                    value={editScope}
                    onChange={(e) => setEditScope(e.target.value as 'project' | '__global__')}
                  >
                    <option value="project">This project</option>
                    <option value="__global__">All projects (global)</option>
                  </NativeSelect>
                </Field>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button type="button" variant="danger" onClick={onDeleteEdit} disabled={savingEdit}>
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="secondary"
                size="icon"
                loading={savingEdit}
                disabled={savingEdit}
                title="Save"
                aria-label="Save"
              >
                <IconSave className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function TimelineToolbar({
  zoom,
  setZoom,
  onToday,
  showAllProjects,
  setShowAllProjects,
  isAdding,
  setIsAdding,
}: {
  zoom: Zoom
  setZoom: (z: Zoom) => void
  onToday: () => void
  showAllProjects: boolean
  setShowAllProjects: (v: boolean) => void
  isAdding: boolean
  setIsAdding: (v: boolean) => void
}) {
  return (
    <div
      className="shrink-0 border-b p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-(--surface-raised)"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="flex items-center gap-3">
        <SegmentedControl
          size="sm"
          ariaLabel="Timeline zoom"
          value={zoom}
          onChange={(v) => setZoom(v as Zoom)}
          options={[
            { value: 'day', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />
        <Button variant="outline" size="sm" onClick={onToday} title="Jump to today">
          Today
        </Button>
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
        <Button variant="secondary" size="sm" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancel' : 'Add label…'}
        </Button>
      </div>
    </div>
  )
}

function AddLabelForm({
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
  return (
    <form
      onSubmit={onAddLabel}
      className="shrink-0 border-b p-4 flex flex-col gap-3 bg-(--surface-raised)"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <div className="text-sm font-medium">New timeline label</div>
      <div className="grid gap-3 sm:grid-cols-5 items-end">
        <div className="sm:col-span-2">
          <Field label="Row label">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Milestone A"
              required
            />
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Description (optional)">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Short note"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="When">
            <Input
              type="datetime-local"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              required
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Scope">
            <NativeSelect
              value={scope}
              onChange={(e) => setScope(e.target.value as 'project' | '__global__')}
            >
              <option value="project">This project</option>
              <option value="__global__">All projects (global)</option>
            </NativeSelect>
          </Field>
        </div>
        <div className="sm:col-span-1">
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            Add
          </Button>
        </div>
      </div>
    </form>
  )
}
