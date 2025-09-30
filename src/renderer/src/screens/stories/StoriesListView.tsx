import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigator } from '@renderer/navigation/Navigator'
import BoardView from './BoardView'
import SegmentedControl from '@renderer/components/ui/SegmentedControl'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import DependencyBullet from '@renderer/components/stories/DependencyBullet'
import StatusControl, {
  STATUS_LABELS,
  StatusPicker,
  statusKey,
} from '@renderer/components/stories/StatusControl'
import { useAgents } from '@renderer/contexts/AgentsContext'
import { Status, Story } from 'thefactory-tools'
import ExclamationChip from '@renderer/components/stories/ExclamationChip'
import { IconBoard, IconEdit, IconPlus, IconList } from '@renderer/components/ui/Icons'
import AgentRunBullet from '@renderer/components/agents/AgentRunBullet'
import RunAgentButton from '@renderer/components/stories/RunAgentButton'
import { RichText } from '@renderer/components/ui/RichText'
import ModelChip from '@renderer/components/agents/ModelChip'
import Skeleton, { SkeletonText } from '@renderer/components/ui/Skeleton'
import { useAppSettings } from '@renderer/contexts/AppSettingsContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import { ChatSidebarPanel } from '@renderer/components/chat'
import { StoryListStatusFilter, StoryListViewSorting, StoryViewMode } from 'src/types/settings'

function countFeatures(story: Story) {
  const features = Array.isArray(story.features) ? story.features : []
  const total = features.length
  const done = features.filter((f) => f.status === '+').length
  return { done, total }
}

function matchesQuery(story: Story, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idStr = String(story.id || '')
  return (
    idStr.includes(s) ||
    story.title?.toLowerCase().includes(s) ||
    story.description?.toLowerCase().includes(s)
  )
}

function filterStories(stories: Story[], { query, status }: { query: string; status: string }) {
  return stories.filter((t) => {
    const hasRejectedFeatures =
      Array.isArray(t.features) && t.features.some((f: any) => !!f.rejection)
    const byStatus =
      !status || status === 'all'
        ? true
        : status === 'not-done'
          ? t.status !== '+' || hasRejectedFeatures
          : t.status === (status as Status)
    return byStatus && matchesQuery(t, query)
  })
}

const STATUS_ORDER = ['-', '~', '+', '=', '?']

export default function StoriesListView() {
  const { isAppSettingsLoaded, appSettings, setUserPreferences } = useAppSettings()
  const view = appSettings.userPreferences.storiesViewMode
  const setView = (view: StoryViewMode) => setUserPreferences({ storiesViewMode: view })
  const sortBy = appSettings.userPreferences.storiesListViewSorting
  const setSortBy = (sortBy: StoryListViewSorting) =>
    setUserPreferences({ storiesListViewSorting: sortBy })
  const statusFilter = appSettings.userPreferences.storiesListViewStatusFilter
  const setStatusFilter = (statusFilter: StoryListStatusFilter) =>
    setUserPreferences({ storiesListViewStatusFilter: statusFilter })

  const [allStories, setAllStories] = useState<Story[]>([])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragStoryId, setDragStoryId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const ulRef = useRef<HTMLUListElement>(null)
  const { openModal, navigateStoryDetails, navigateAgentRun } = useNavigator()
  const [openFilter, setOpenFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  const { project, projectId } = useActiveProject()
  const {
    storyIdsByProject,
    storiesById,
    updateStory,
    reorderStory,
    getBlockers,
    getBlockersOutbound,
  } = useStories()
  const { runsActive, startAgent } = useAgents()

  useEffect(() => {
    const storyIds = storyIdsByProject[projectId] ?? []
    const stories = storyIds.map((s) => storiesById[s]).filter((s) => s !== undefined)
    setAllStories(stories)
  }, [projectId, storyIdsByProject, storiesById])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openModal({ type: 'story-create' })
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'b')
      ) {
        e.preventDefault()
        setView(view === 'list' ? 'board' : 'list')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal, view])

  const storyIdToDisplayIndex: Record<string, number> = useMemo(() => {
    return project?.storyIdToDisplayIndex ?? {}
  }, [project])

  const sorted = useMemo(() => {
    let stories = [...allStories]
    if (project) {
      if (sortBy === 'index_asc') {
        stories.sort((a, b) => storyIdToDisplayIndex[a.id] - storyIdToDisplayIndex[b.id])
      } else if (sortBy === 'index_desc') {
        stories.sort((a, b) => storyIdToDisplayIndex[b.id] - storyIdToDisplayIndex[a.id])
      } else if (sortBy === 'status_asc') {
        const sVal = (t: Story) => STATUS_ORDER.indexOf(t.status)
        stories.sort(
          (a, b) => sVal(a) - sVal(b) || storyIdToDisplayIndex[a.id] - storyIdToDisplayIndex[b.id],
        )
      } else if (sortBy === 'status_desc') {
        const sVal = (t: Story) => STATUS_ORDER.indexOf(t.status)
        stories.sort(
          (a, b) => sVal(b) - sVal(a) || storyIdToDisplayIndex[b.id] - storyIdToDisplayIndex[a.id],
        )
      }
    }
    return stories
  }, [storyIdToDisplayIndex, allStories, sortBy, project])

  const filtered = useMemo(
    () => filterStories(sorted, { query, status: statusFilter }),
    [sorted, query, statusFilter],
  )

  const isSearchFiltered = query !== ''

  const handleAddStory = () => {
    openModal({ type: 'story-create' })
  }

  const handleEditStory = (storyId: string) => {
    openModal({ type: 'story-edit', storyId })
  }

  const handleMoveStory = async (fromIndex: number, toIndex: number) => {
    if (saving) return
    setSaving(true)
    try {
      await reorderStory({ fromIndex, toIndex })
    } catch (e: any) {
      alert(`Failed to reorder story: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (storyId: string, status: Status) => {
    try {
      await updateStory(storyId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const dndEnabled =
    (sortBy === 'index_asc' || sortBy === 'index_desc') &&
    !isSearchFiltered &&
    !saving &&
    view === 'list'

  const computeDropForRow = (e: React.DragEvent<HTMLElement>, idx: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    let pos: 'before' | 'after' | null = offsetY < rect.height / 2 ? 'before' : 'after'
    if (
      draggingIndex != null &&
      (idx == draggingIndex ||
        (idx == draggingIndex - 1 && pos == 'after') ||
        (idx == draggingIndex + 1 && pos == 'before'))
    ) {
      pos = null
    }
    setDropIndex(idx)
    setDropPosition(pos)
  }

  const clearDndState = () => {
    setDragStoryId(null)
    setDragging(false)
    setDraggingIndex(null)
    setDropIndex(null)
    setDropPosition(null)
  }

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, storyId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      navigateStoryDetails(storyId)
      return
    }
    if (e.key.toLowerCase() === 's') {
      e.preventDefault()
      const current = allStories.find((t) => t.id === storyId)?.status
      const order: Status[] = ['-', '~', '+', '=', '?']
      const next = order[(Math.max(0, order.indexOf(current as Status)) + 1) % order.length]
      handleStatusChange(storyId, next)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const ul = ulRef.current
    if (!ul) return
    const rows = Array.from(ul.querySelectorAll('.story-row'))
    const current = e.currentTarget
    const i = rows.indexOf(current)
    if (i === -1) return
    let nextIndex = i + (e.key === 'ArrowDown' ? 1 : -1)
    if (nextIndex < 0) nextIndex = 0
    if (nextIndex >= rows.length) nextIndex = rows.length - 1
    ;(rows[nextIndex] as HTMLElement).focus()
  }

  const onListDrop = () => {
    if (project != null && dragStoryId != null && dropIndex != null && dropPosition != null) {
      const fromIndex = project.storyIdToDisplayIndex[dragStoryId] - 1
      // Use the item from the currently rendered list (filtered), not from the full sorted list by index
      const toStory = filtered[dropIndex]
      if (!toStory) {
        clearDndState()
        return
      }
      let toIndex = (project.storyIdToDisplayIndex[toStory.id] ?? 1) - 1
      if (dropPosition === 'after') {
        toIndex = toIndex + 1
      }
      if (fromIndex !== -1 && toIndex !== fromIndex) {
        handleMoveStory(fromIndex, toIndex)
      }
    }
    clearDndState()
  }

  const currentFilterLabel =
    statusFilter === 'all'
      ? 'All'
      : statusFilter === 'not-done'
        ? 'Not done'
        : `${STATUS_LABELS[statusFilter as Status]}`
  const k =
    statusFilter === 'all'
      ? 'queued'
      : statusFilter === 'not-done'
        ? 'queued'
        : statusKey(statusFilter as Status)

  const SkeletonRow = () => (
    <li className="story-item" role="listitem" aria-hidden>
      <div className="story-row">
        <div className="story-grid">
          <div className="col col-id">
            <Skeleton className="w-8 h-5 rounded-sm mr-2" />
            <div className="flex items-center gap-2 mt-2">
              <Skeleton className="w-6 h-6 rounded-full" />
              <Skeleton className="w-10 h-3 rounded" />
            </div>
          </div>
          <div className="col col-title">
            <div className="title-line">
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          </div>
          <div className="col col-description">
            <div className="desc-line">
              <SkeletonText lines={2} lineClassName="w-[90%]" />
            </div>
          </div>
          <div className="col col-actions">
            <div className="flex items-center gap-2 justify-end">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="w-20 h-8 rounded" />
            </div>
          </div>
          <div className="col col-blockers">
            <div className="chips-list">
              <Skeleton className="w-16 h-3 rounded" />
              <div className="flex flex-wrap gap-1 mt-2">
                <Skeleton className="w-12 h-6 rounded-full" />
                <Skeleton className="w-12 h-6 rounded-full" />
                <Skeleton className="w-12 h-6 rounded-full" />
              </div>
            </div>
            <div className="chips-list mt-3">
              <Skeleton className="w-12 h-3 rounded" />
              <div className="flex flex-wrap gap-1 mt-2">
                <Skeleton className="w-10 h-6 rounded-full" />
                <Skeleton className="w-10 h-6 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  )

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden">
      <section
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
        id="stories-view"
        role="region"
        aria-labelledby="stories-view-heading"
      >
        <div className="stories-menubar shrink-0">
          <div className="left"></div>
          <div className="center">
            <SegmentedControl
              ariaLabel="Toggle between list and board views"
              options={[
                { value: 'list', label: 'List', icon: <IconList /> },
                { value: 'board', label: 'Board', icon: <IconBoard /> },
              ]}
              value={view}
              onChange={(v) => setView(v as 'list' | 'board')}
              size="sm"
            />
          </div>
          <div className="right">
            <ModelChip editable className="mr-2" />
          </div>
        </div>

        {/* Search and filters toolbar (wraps to two rows on small screens) */}
        <div className="stories-toolbar stories-searchbar shrink-0">
          <div className="left flex flex-wrap items-center gap-2 w-full">
            <div className="control search-wrapper min-w-0 flex-1 basis-full sm:basis-auto">
              <input
                id="stories-search-input"
                type="search"
                placeholder="Search by id, title, or description"
                aria-label="Search stories"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Group status filter and sort so they wrap to a second row on small screens */}
            <div className="flex gap-2 basis-full sm:basis-auto">
              <div className="control flex-1 sm:flex-none basis-1/2 sm:basis-auto">
                <div
                  ref={statusFilterRef}
                  className="status-filter-btn ui-select gap-2"
                  role="button"
                  aria-haspopup="menu"
                  aria-expanded={openFilter}
                  aria-label="Filter by status"
                  tabIndex={0}
                  onClick={() => setOpenFilter(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setOpenFilter(true)
                  }}
                >
                  <span className={`status-bullet status-bullet--${k}`} aria-hidden />
                  <span className="standard-picker__label">{currentFilterLabel}</span>
                </div>
                {openFilter && statusFilterRef.current && (
                  <StatusPicker
                    anchorEl={statusFilterRef.current}
                    value={statusFilter as any}
                    isAllAllowed={true}
                    includeNotDone={true}
                    onSelect={(val) => {
                      setStatusFilter(val as StoryListStatusFilter)
                      setOpenFilter(false)
                    }}
                    onClose={() => setOpenFilter(false)}
                  />
                )}
              </div>

              <div className="control flex-1 sm:flex-none basis-1/2 sm:basis-auto">
                <select
                  className="ui-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="Sort by"
                  disabled={!isAppSettingsLoaded}
                >
                  <option value="index_asc">Ascending ↓</option>
                  <option value="index_desc">Descending ↑</option>
                  <option value="status_asc">Status ↓</option>
                  <option value="status_desc">Status ↑</option>
                </select>
              </div>
            </div>
          </div>
          <div className="right" />
        </div>

        <div className="stories-toolbar shrink-0">
          <div className="left">
            <div id="stories-count" className="stories-count shrink-0" aria-live="polite">
              Showing {filtered.length} of {allStories.length} stories
              {!isAppSettingsLoaded ? ' • Loading settings…' : ''}
            </div>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Add Story"
              onClick={handleAddStory}
            >
              <IconPlus className="h-[20px] w-[20px]" />
            </button>
          </div>
        </div>

        {view === 'board' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <BoardView stories={filtered} />
          </div>
        ) : (
          <div
            id="stories-results"
            className="flex-1 min-h-0 overflow-y-auto stories-results"
            tabIndex={-1}
          >
            {!isAppSettingsLoaded ? (
              <ul className="stories-list" role="list" aria-label="Loading stories">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </ul>
            ) : filtered.length === 0 ? (
              <div className="empty">No stories found.</div>
            ) : (
              <ul
                className={`stories-list ${dragging ? 'dnd-active' : ''}`}
                role="list"
                aria-label="Stories"
                ref={ulRef}
                onDragOver={(e) => {
                  if (dndEnabled) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }
                }}
                onDrop={(e) => {
                  if (!dndEnabled || !dragging) return
                  e.preventDefault()
                  onListDrop()
                }}
                onDragEnd={() => clearDndState()}
              >
                {filtered.map((t, idx) => {
                  const { done, total } = countFeatures(t)
                  const isDragSource = dragStoryId === t.id
                  const isDropBefore = dragging && dropIndex === idx && dropPosition === 'before'
                  const isDropAfter = dragging && dropIndex === idx && dropPosition === 'after'
                  const blockers = getBlockers(t.id)
                  const blockersOutbound = getBlockersOutbound(t.id)
                  const hasRejectedFeatures = t.features.filter((f) => !!f.rejection).length > 0
                  const storyRun = runsActive.find((r) => r.storyId === t.id)

                  return (
                    <li key={t.id} className="story-item" role="listitem">
                      {isDropBefore && <div className="drop-indicator" aria-hidden="true"></div>}
                      <div
                        className={`story-row ${dndEnabled ? 'draggable' : ''} ${isDragSource ? 'is-dragging' : ''} ${dragging && dropIndex === idx ? 'is-drop-target' : ''}`}
                        tabIndex={0}
                        role="button"
                        data-index={idx}
                        draggable={dndEnabled}
                        aria-grabbed={isDragSource}
                        onDragStart={(e) => {
                          if (!dndEnabled) return
                          setDragStoryId(t.id)
                          setDragging(true)
                          setDraggingIndex(idx)
                          e.dataTransfer.setData('text/plain', String(t.id))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragOver={(e) => {
                          if (!dndEnabled) return
                          e.preventDefault()
                          computeDropForRow(e, idx)
                        }}
                        onClick={() => navigateStoryDetails(t.id)}
                        onKeyDown={(e) => onRowKeyDown(e, t.id)}
                        aria-label={`Story ${t.id}: ${t.title}. Description: ${t.description}. Status ${STATUS_LABELS[t.status as Status] || t.status}. Features ${done} of ${total} done. ${blockers.length} items this story is blocked by, ${blockersOutbound.length} items this story is blocking. Press Enter to view details.`}
                      >
                        <div className="story-grid">
                          <div className="col col-id">
                            <div className="flex justify-center gap-0.5 items-center">
                              {storyRun && (
                                // <div className="no-drag">
                                <AgentRunBullet
                                  key={storyRun.id}
                                  run={storyRun}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigateAgentRun(storyRun.id)
                                  }}
                                />
                                // </div>
                              )}
                              <span className="id-chip">{storyIdToDisplayIndex[t.id]}</span>
                            </div>
                            <StatusControl
                              status={t.status}
                              onChange={(next) => handleStatusChange(t.id, next)}
                            />
                            <div className="flex justify-center gap-1">
                              {hasRejectedFeatures && (
                                <ExclamationChip
                                  title={'One or more features were rejected'}
                                  tooltip="Has rejection reason"
                                />
                              )}
                              <span className="chips-sub__label" title="No dependencies">
                                {done}/{total}
                              </span>
                            </div>
                          </div>
                          <div className="col col-title">
                            <div className="title-line">
                              <span className="title-text">
                                <RichText text={t.title || ''} />
                              </span>
                            </div>
                          </div>
                          <div className="col col-description">
                            <div className="desc-line" title={t.description || ''}>
                              <RichText text={t.description || ''} />
                            </div>
                          </div>
                          <div className={`col col-actions`}>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                className="btn-secondary btn-icon"
                                aria-label="Edit story"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditStory(t.id)
                                }}
                              >
                                <IconEdit className="h-[16px] w-[16px]" />
                              </button>
                              {!storyRun && (
                                <div
                                  className="no-drag"
                                  onClick={(e) => e.stopPropagation()}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <RunAgentButton
                                    onClick={(agentType) => {
                                      if (!projectId) return
                                      startAgent(agentType, projectId, t.id)
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className="col col-blockers"
                            aria-label={`Blockers for Story ${t.id}`}
                          >
                            <div className="chips-list">
                              <span className="chips-sub__label">References</span>
                              {blockers.length === 0 ? (
                                <span className="chips-sub__label" title="No dependencies">
                                  None
                                </span>
                              ) : (
                                blockers.map((d) => (
                                  <DependencyBullet key={d.id} dependency={d.id} />
                                ))
                              )}
                            </div>
                            <div className="chips-list">
                              <span className="chips-sub__label">Blocks</span>
                              {blockersOutbound.length === 0 ? (
                                <span className="chips-sub__label" title="No dependents">
                                  None
                                </span>
                              ) : (
                                blockersOutbound.map((d) => (
                                  <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {isDropAfter && <div className="drop-indicator" aria-hidden="true"></div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {saving && (
          <div
            className="saving-indicator"
            aria-live="polite"
            style={{ position: 'fixed', bottom: 12, right: 16 }}
          >
            Reordering…
          </div>
        )}
      </section>

      {projectId && (
        <ChatSidebarPanel
          context={{ projectId, type: 'PROJECT' }}
          chatContextTitle={project ? `Project Chat — ${project.title}` : 'Project Chat'}
          initialWidth={appSettings.userPreferences.chatSidebarWidth || 420}
          onWidthChange={(w, final) => {
            if (final) setUserPreferences({ chatSidebarWidth: Math.round(w) })
          }}
        />
      )}
    </div>
  )
}
