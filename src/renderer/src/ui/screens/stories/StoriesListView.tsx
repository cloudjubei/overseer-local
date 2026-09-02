import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActiveProject } from 'thefactory-ui/headless'
import { STATUS_ORDER as HEADLESS_STATUS_ORDER } from 'thefactory-ui/headless'
import { useAppSettings } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useAgents } from 'thefactory-ui/headless'
import type {
  StoriesListSorting,
  StoriesListStatusFilter,
  StoriesViewMode,
} from '@core/types/settings'
import type { GetStoryResponse } from 'thefactory-ui/headless/api'
import {
  OptionPicker,
  SegmentedControl,
  Spinner,
  StatusControl,
  StatusPicker,
  STATUS_LABELS,
  statusKey,
} from 'thefactory-ui/web'
import { IconBoard, IconCalculator, IconList, IconPlus } from 'thefactory-ui/web/icons'
import { DependencyBullet } from 'thefactory-ui/web'
import { ExclamationChip } from 'thefactory-ui/web'
import RunAgentButtonConnected from '@ui/components/agents/RunAgentButtonConnected'
import { ModelChipConnected } from 'thefactory-ui/web'
import { UsageModalConnected as UsageModal } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import ChatSidebarPanelConnected from '@ui/components/chat/ChatSidebarPanelConnected'
import { BoardView } from 'thefactory-ui/web'
import StoriesModalHost from './StoriesModalHost'
import type { StoryModalRoute } from './storyModals'

type Status = GetStoryResponse['status']

const STORIES_SORT_OPTIONS: { value: StoriesListSorting; label: string }[] = [
  { value: 'index_asc', label: 'Ascending ↓' },
  { value: 'index_desc', label: 'Descending ↑' },
  { value: 'status_asc', label: 'Status ↓' },
  { value: 'status_desc', label: 'Status ↑' },
]

function countFeatures(story: GetStoryResponse) {
  const features = Array.isArray(story.features) ? story.features : []
  const total = features.length
  const done = features.filter((f) => f.status === 'done').length
  return { done, total }
}

/** Match a story against the search box. Searches by display index (e.g.
 *  `5`, since the uuid is never user-visible), title and description. */
function matchesQuery(story: GetStoryResponse, displayIndex: number | undefined, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idxStr = displayIndex != null ? String(displayIndex) : ''
  return (
    idxStr.includes(s) ||
    !!story.title?.toLowerCase().includes(s) ||
    !!story.description?.toLowerCase().includes(s)
  )
}

function filterStories(
  stories: GetStoryResponse[],
  indexOf: (id: string) => number | undefined,
  { query, status }: { query: string; status: string },
) {
  return stories.filter((t) => {
    const hasRejectedFeatures =
      Array.isArray(t.features) && t.features.some((f) => !!(f as { rejection?: string }).rejection)
    const byStatus =
      !status || status === 'all'
        ? true
        : status === 'not-done'
          ? t.status !== 'done' || hasRejectedFeatures
          : t.status === (status as Status)
    return byStatus && matchesQuery(t, indexOf(t.id), query)
  })
}

const STATUS_ORDER: string[] = [...HEADLESS_STATUS_ORDER]

/**
 * Dense list of stories — visual & interaction parity with desktop's
 * `StoriesListView`. Uses the shared `.story-row` / `.col-*` CSS recipe from
 * `thefactory-ui` so both apps render identically. Open / Edit / Create
 * routes are pushed through the existing modal host.
 */
export default function StoriesListView() {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const { project, projectId } = useActiveProject()
  const { settings, setUserPreferences } = useAppSettings()
  const view = settings.userPreferences.storiesViewMode
  const setView = (v: StoriesViewMode) => setUserPreferences({ storiesViewMode: v })
  const sortBy = settings.userPreferences.storiesListViewSorting
  const setSortBy = (v: StoriesListSorting) => setUserPreferences({ storiesListViewSorting: v })
  const statusFilter = settings.userPreferences.storiesListViewStatusFilter
  const setStatusFilter = (v: StoriesListStatusFilter) =>
    setUserPreferences({ storiesListViewStatusFilter: v })

  const {
    isLoaded,
    stories,
    storyDisplayIndex,
    updateStory,
    moveStory,
    getBlockers,
    getBlockersOutbound,
  } = useStories()
  const { runsActive } = useAgents()

  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<StoryModalRoute | null>(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragStoryId, setDragStoryId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const ulRef = useRef<HTMLUListElement>(null)

  const [openFilter, setOpenFilter] = useState(false)
  const [openSort, setOpenSort] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setModal({ kind: 'create-story' })
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
  }, [view, setView])

  const sorted = useMemo(() => {
    const out = [...stories]
    if (!project) return out
    if (sortBy === 'index_asc') {
      out.sort((a, b) => (storyDisplayIndex(a.id) || 0) - (storyDisplayIndex(b.id) || 0))
    } else if (sortBy === 'index_desc') {
      out.sort((a, b) => (storyDisplayIndex(b.id) || 0) - (storyDisplayIndex(a.id) || 0))
    } else if (sortBy === 'status_asc') {
      const sVal = (t: GetStoryResponse) => STATUS_ORDER.indexOf(t.status)
      out.sort(
        (a, b) =>
          sVal(a) - sVal(b) || (storyDisplayIndex(a.id) || 0) - (storyDisplayIndex(b.id) || 0),
      )
    } else if (sortBy === 'status_desc') {
      const sVal = (t: GetStoryResponse) => STATUS_ORDER.indexOf(t.status)
      out.sort(
        (a, b) =>
          sVal(b) - sVal(a) || (storyDisplayIndex(b.id) || 0) - (storyDisplayIndex(a.id) || 0),
      )
    }
    return out
  }, [stories, sortBy, project, storyDisplayIndex])

  const filtered = useMemo(
    () => filterStories(sorted, storyDisplayIndex, { query, status: statusFilter }),
    [sorted, storyDisplayIndex, query, statusFilter],
  )

  const isSearchFiltered = query !== ''

  const handleStatusChange = async (storyId: string, status: Status) => {
    try {
      await updateStory(storyId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const handleEditStory = (story: GetStoryResponse) => setModal({ kind: 'edit-story', story })
  const handleAddStory = () => setModal({ kind: 'create-story' })

  const navigateStoryDetails = (storyId: string) => {
    const pId = projectId ?? urlProjectId
    if (!pId) return
    navigate(`/projects/${pId}/stories/${storyId}`)
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
      (idx === draggingIndex ||
        (idx === draggingIndex - 1 && pos === 'after') ||
        (idx === draggingIndex + 1 && pos === 'before'))
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
      const current = stories.find((t) => t.id === storyId)?.status
      const order = HEADLESS_STATUS_ORDER
      const next = order[(Math.max(0, order.indexOf(current as Status)) + 1) % order.length]
      void handleStatusChange(storyId, next)
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

  const onListDrop = async () => {
    if (!project || !dragStoryId || dropIndex == null || dropPosition == null) {
      clearDndState()
      return
    }
    const toStory = filtered[dropIndex]
    if (!toStory) {
      clearDndState()
      return
    }
    const fromIndex = storyDisplayIndex(dragStoryId)
    const toIndex = storyDisplayIndex(toStory.id)
    if (!fromIndex || !toIndex || toIndex === fromIndex) {
      clearDndState()
      return
    }
    setSaving(true)
    try {
      // The web `moveStory(direction)` only steps one at a time; iterate
      // until we land on the target slot. Mirrors desktop's behaviour from
      // the reorderStory SDK call.
      const direction = toIndex > fromIndex ? 'down' : 'up'
      const steps = Math.abs(toIndex - fromIndex)
      for (let i = 0; i < steps; i++) {
        await moveStory(dragStoryId, direction)
      }
    } catch (e) {
      console.error('Failed to reorder story', e)
    } finally {
      setSaving(false)
      clearDndState()
    }
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
  const currentSortLabel = STORIES_SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? ''

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
              onChange={(v) => setView(v as StoriesViewMode)}
              size="sm"
            />
          </div>
          <div className="right flex items-center gap-2">
            <ModelChipConnected editable mode="agentRun" />
            <button
              type="button"
              onClick={() => setUsageOpen(true)}
              className="btn-secondary btn-icon"
              aria-label="View usage costs"
              title="Usage costs"
            >
              <IconCalculator className="w-4 h-4" />
            </button>
          </div>
        </div>
        <UsageModal
          isOpen={usageOpen}
          onClose={() => setUsageOpen(false)}
          messages={[]}
          chatKey={
            (projectId ?? urlProjectId)
              ? getChatContextKey({
                  type: 'PROJECT',
                  projectId: (projectId ?? urlProjectId) as string,
                })
              : undefined
          }
        />

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
                    value={statusFilter}
                    isAllAllowed
                    includeNotDone
                    onSelect={(val) => {
                      setStatusFilter(val as StoriesListStatusFilter)
                      setOpenFilter(false)
                    }}
                    onClose={() => setOpenFilter(false)}
                  />
                )}
              </div>

              <div className="control flex-1 sm:flex-none basis-1/2 sm:basis-auto">
                <div
                  ref={sortRef}
                  className="status-filter-btn ui-select"
                  role="button"
                  aria-haspopup="menu"
                  aria-expanded={openSort}
                  aria-label="Sort by"
                  tabIndex={0}
                  onClick={() => setOpenSort(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setOpenSort(true)
                  }}
                >
                  <span className="standard-picker__label">{currentSortLabel}</span>
                </div>
                {openSort && sortRef.current && (
                  <OptionPicker
                    anchorEl={sortRef.current}
                    value={sortBy}
                    options={STORIES_SORT_OPTIONS}
                    ariaLabel="Sort by"
                    onSelect={(v) => {
                      setSortBy(v as StoriesListSorting)
                      setOpenSort(false)
                    }}
                    onClose={() => setOpenSort(false)}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="right" />
        </div>

        <div className="stories-toolbar shrink-0">
          <div className="left">
            <div id="stories-count" className="stories-count shrink-0" aria-live="polite">
              Showing {filtered.length} of {stories.length} stories
            </div>
          </div>
          <div className="right">
            <button
              type="button"
              className="btn btn-icon"
              aria-label="Add Story"
              onClick={handleAddStory}
            >
              <IconPlus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {view === 'board' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <BoardView
              stories={filtered}
              storyDisplayIndex={storyDisplayIndex}
              onEdit={(id) => {
                const s = stories.find((x) => x.id === id)
                if (s) handleEditStory(s)
              }}
              onChangeStoryStatus={(id, status) => void handleStatusChange(id, status as Status)}
            />
          </div>
        ) : (
          <div
            id="stories-results"
            className="flex-1 min-h-0 overflow-y-auto stories-results"
            tabIndex={-1}
          >
            {!isLoaded ? (
              <div
                className="flex flex-col items-center justify-center h-full gap-3 opacity-70"
                aria-busy="true"
              >
                <Spinner size={28} />
                <span className="text-sm">Loading stories…</span>
              </div>
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
                  void onListDrop()
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
                  const hasRejectedFeatures = (t.features || []).some(
                    (f) => !!(f as { rejection?: string }).rejection,
                  )
                  const storyRun = runsActive.find((r) => r.context.storyId === t.id)
                  const displayIdx = storyDisplayIndex(t.id)

                  return (
                    <li key={t.id} className="story-item" role="listitem">
                      {isDropBefore && <div className="drop-indicator" aria-hidden="true"></div>}
                      <div
                        className={`story-row ${dndEnabled ? 'draggable' : ''} ${
                          isDragSource ? 'is-dragging' : ''
                        } ${dragging && dropIndex === idx ? 'is-drop-target' : ''}`}
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
                              <span className="id-chip">{displayIdx}</span>
                            </div>
                            <StatusControl
                              status={t.status}
                              onChange={(next) => void handleStatusChange(t.id, next as Status)}
                            />
                            <div className="flex justify-center gap-1">
                              {hasRejectedFeatures && (
                                <ExclamationChip
                                  title="One or more features were rejected"
                                  tooltip="Has rejection reason"
                                />
                              )}
                              <span className="chips-sub__label" title="Features done / total">
                                {done}/{total}
                              </span>
                            </div>
                          </div>
                          <div className="col col-title">
                            <div className="title-line">
                              <span className="title-text">{t.title || ''}</span>
                            </div>
                          </div>
                          <div className="col col-description">
                            <div className="desc-line" title={t.description || ''}>
                              {t.description || ''}
                            </div>
                          </div>
                          <div className="col col-actions">
                            {!storyRun && projectId && (
                              <div
                                className="no-drag flex items-center justify-end"
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <RunAgentButtonConnected projectId={projectId} storyId={t.id} />
                              </div>
                            )}
                          </div>
                          {(blockers.length > 0 || blockersOutbound.length > 0) && (
                            <div
                              className="col col-blockers"
                              aria-label={`Blockers for Story ${t.id}`}
                            >
                              {blockers.length > 0 && (
                                <div className="chips-list">
                                  <span className="chips-sub__label">References</span>
                                  {blockers.map((d) => (
                                    <DependencyBullet key={d.id} dependency={d.id} />
                                  ))}
                                </div>
                              )}
                              {blockersOutbound.length > 0 && (
                                <div className="chips-list">
                                  <span className="chips-sub__label">Blocks</span>
                                  {blockersOutbound.map((d) => (
                                    <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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
        <ChatSidebarPanelConnected
          context={{ type: 'PROJECT', projectId }}
          chatContextTitle={project ? `Project Chat — ${project.title}` : 'Project Chat'}
        />
      )}

      <StoriesModalHost route={modal} onClose={() => setModal(null)} />
    </div>
  )
}
