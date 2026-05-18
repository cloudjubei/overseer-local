import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useStories } from '@core/contexts/StoriesContext'
import { useAgents } from '@core/contexts/AgentsContext'
import type { Feature, GetStoryResponse } from '@generated/backend'
import { Button, StatusControl, StatusPicker, STATUS_LABELS, statusKey } from 'thefactory-ui/web'
import { IconBack, IconCalculator, IconChevron, IconEdit, IconPlus } from 'thefactory-ui/web/icons'
import DependencyBullet from '@ui/components/stories/DependencyBullet'
import ExclamationChip from '@ui/components/stories/ExclamationChip'
import RunAgentButton from '@ui/components/agents/RunAgentButton'
import ModelChip from '@ui/components/agents/ModelChip'
import UsageModal from '@ui/components/chat/UsageModal'
import { getChatContextKey } from '@core/chats/chatKey'
import ChatSidebarPanel from '@ui/components/chat/ChatSidebarPanel'
import StoriesModalHost from './StoriesModalHost'
import type { StoryModalRoute } from './storyModals'

type Status = GetStoryResponse['status']
type FeatureSort = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']

/** Match a feature against the search box. Searches by display index
 *  (e.g. `2`, the user-visible position; the uuid is never shown), title
 *  and description. */
function featureMatchesQuery(f: Feature, displayIndex: number, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  return (
    String(displayIndex).includes(s) ||
    (f.title || '').toLowerCase().includes(s) ||
    (f.description || '').toLowerCase().includes(s)
  )
}

function getFeatureIndex(story: GetStoryResponse | null, featureId: string): number {
  if (!story || !story.features) return 0
  const idx = story.features.findIndex((f) => f.id === featureId)
  return idx >= 0 ? idx + 1 : 0
}

/**
 * Story details view — visual & interaction parity with desktop's
 * `StoryDetailsView`. Renders the same `.feature-row` / `.col-*` recipe
 * from `thefactory-ui` so both apps render identically.
 */
export default function StoryDetailsView({ storyId }: { storyId: string }) {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const { projectId } = useActiveProject()
  const {
    stories,
    storyDisplayIndex,
    updateStory,
    updateFeature,
    getBlockers,
    getBlockersOutbound,
  } = useStories()
  const { runsActive } = useAgents()

  const story = useMemo<GetStoryResponse | null>(
    () => stories.find((s) => s.id === storyId) ?? null,
    [stories, storyId],
  )

  const [saving] = useState(false)
  const [modal, setModal] = useState<StoryModalRoute | null>(null)
  const [usageOpen, setUsageOpen] = useState(false)
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false)
  const ulRef = useRef<HTMLUListElement>(null)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'not-done' | Status>('not-done')
  const [sortBy, setSortBy] = useState<FeatureSort>('index_asc')
  const [openFilter, setOpenFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  const sortedFeaturesBase = useMemo(() => (story ? [...story.features] : []), [story])

  const featuresSorted = useMemo(() => {
    const arr = [...sortedFeaturesBase]
    if (sortBy === 'index_asc') return arr
    if (sortBy === 'index_desc') return arr.slice().reverse()
    if (sortBy === 'status_asc') {
      const sVal = (f: Feature) => STATUS_ORDER.indexOf(f.status as Status)
      return arr.sort(
        (a, b) =>
          sVal(a) - sVal(b) ||
          (story ? getFeatureIndex(story, a.id) - getFeatureIndex(story, b.id) : 0),
      )
    }
    if (sortBy === 'status_desc') {
      const sVal = (f: Feature) => STATUS_ORDER.indexOf(f.status as Status)
      return arr.sort(
        (a, b) =>
          sVal(b) - sVal(a) ||
          (story ? getFeatureIndex(story, b.id) - getFeatureIndex(story, a.id) : 0),
      )
    }
    return arr
  }, [sortedFeaturesBase, sortBy, story])

  const featuresFiltered = useMemo(
    () =>
      featuresSorted.filter((f) => {
        const byStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'not-done'
              ? f.status !== '+' || !!(f as { rejection?: string }).rejection
              : f.status === statusFilter
        return byStatus && featureMatchesQuery(f, getFeatureIndex(story, f.id), query)
      }),
    [featuresSorted, statusFilter, query, story],
  )

  const storyRun = useMemo(
    () =>
      story
        ? runsActive.find((r) => r.context.storyId === story.id && !r.context.featureId)
        : undefined,
    [story, runsActive],
  )

  const handleEditStory = () => {
    if (!story) return
    setModal({ kind: 'edit-story', story })
  }
  const handleAddFeature = () => {
    if (!story) return
    setModal({ kind: 'create-feature', storyId: story.id })
  }
  const handleEditFeature = (feature: Feature) => {
    if (!story) return
    setModal({ kind: 'edit-feature', storyId: story.id, feature })
  }

  const handleStoryStatusChange = async (status: Status) => {
    if (!story) return
    try {
      await updateStory(story.id, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const handleFeatureStatusChange = async (
    storyIdLocal: string,
    featureId: string,
    status: Status,
  ) => {
    try {
      await updateFeature(storyIdLocal, featureId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, feature: Feature) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditFeature(feature)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const ul = ulRef.current
    if (!ul) return
    const rows = Array.from(ul.querySelectorAll('.feature-row'))
    const current = e.currentTarget
    const i = rows.indexOf(current)
    if (i === -1) return
    let nextIndex = i + (e.key === 'ArrowDown' ? 1 : -1)
    if (nextIndex < 0) nextIndex = 0
    if (nextIndex >= rows.length) nextIndex = rows.length - 1
    ;(rows[nextIndex] as HTMLElement).focus()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        if (story) setModal({ kind: 'create-feature', storyId: story.id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [story])

  if (!story) {
    return (
      <div className="story-details flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <header className="details-header shrink-0">
          <div className="details-header__bar flex items-center gap-3">
            <Button
              className="btn-secondary"
              onClick={() => navigate(`/projects/${projectId ?? urlProjectId}/stories`)}
            >
              <IconBack className="w-4 h-4" />
              <span className="sr-only">Back to Stories</span>
            </Button>
            <h1 className="details-title">Story {storyId}</h1>
          </div>
        </header>
        <main className="details-content flex-1 min-h-0 overflow-auto p-4">
          <div className="empty">Story {storyId} not found.</div>
        </main>
      </div>
    )
  }

  const sIndex = storyDisplayIndex(story.id) ?? '?'
  const storyBlockers = getBlockers(story.id)
  const storyBlockersOutbound = getBlockersOutbound(story.id)
  const storyHasActiveRun = !!storyRun
  const hasRejectedFeatures = story.features.some((f) => !!(f as { rejection?: string }).rejection)
  const showStoryBlockersSection = storyBlockers.length > 0 || storyBlockersOutbound.length > 0

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

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden">
      <div
        className="story-details flex flex-col flex-1 min-h-0 w-full overflow-hidden"
        role="region"
        aria-labelledby="story-details-heading"
      >
        <header className="details-header shrink-0">
          <div className="details-header__bar flex flex-wrap items-start gap-3">
            <Button
              className="btn-secondary w-9"
              onClick={() => navigate(`/projects/${projectId ?? urlProjectId}/stories`)}
              aria-label="Back to Stories"
            >
              <IconBack className="w-4 h-4" />
            </Button>

            <div
              className="col col-id flex flex-col items-center gap-1 order-1"
              style={{ gridRow: '1 / 4', alignSelf: 'center' }}
            >
              {hasRejectedFeatures && (
                <ExclamationChip
                  title="One or more features were rejected"
                  tooltip="Has rejection reason"
                />
              )}
              <span className="id-chip">{sIndex}</span>
              <StatusControl
                status={story.status}
                onChange={(next) => void handleStoryStatusChange(next as Status)}
              />
            </div>

            <h1 id="story-details-heading" className="details-title flex-1 min-w-0 order-2">
              {story.title || `Story ${sIndex}`}
            </h1>

            <div className="flex items-center gap-3 order-3 basis-full justify-end sm:order-3 sm:basis-auto sm:ml-auto">
              {!storyHasActiveRun && projectId && (
                <div
                  className="no-drag"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RunAgentButton projectId={projectId} storyId={story.id} />
                </div>
              )}
              <ModelChip editable />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setUsageOpen(true)
                }}
                className="btn-secondary btn-icon"
                aria-label="View usage costs"
                title="Usage costs"
              >
                <IconCalculator className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
        <UsageModal
          isOpen={usageOpen}
          onClose={() => setUsageOpen(false)}
          messages={[]}
          chatKey={
            (projectId ?? urlProjectId)
              ? getChatContextKey({
                  type: 'STORY',
                  projectId: (projectId ?? urlProjectId) as string,
                  storyId,
                })
              : undefined
          }
        />

        {showStoryBlockersSection && (
          <section className="panel shrink-0" aria-label={`Blockers for Story ${sIndex}`}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="chips-list">
                <span className="chips-sub__label">Blockers</span>
                {storyBlockers.length === 0 ? (
                  <span className="chips-sub__label" title="No dependencies">
                    None
                  </span>
                ) : (
                  storyBlockers.map((d) => <DependencyBullet key={d.id} dependency={d.id} />)
                )}
              </div>
              <div className="chips-list">
                <span className="chips-sub__label">Blocks</span>
                {storyBlockersOutbound.length === 0 ? (
                  <span className="chips-sub__label" title="No dependents">
                    None
                  </span>
                ) : (
                  storyBlockersOutbound.map((d) => (
                    <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        <div className="stories-toolbar shrink-0">
          <div className="left flex flex-wrap items-center gap-2 w-full">
            <div className="control search-wrapper min-w-0 flex-1 basis-full sm:basis-auto">
              <input
                type="search"
                placeholder="Search by id, title, or description"
                aria-label="Search features"
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
                      setStatusFilter(val as 'all' | 'not-done' | Status)
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
                  onChange={(e) => setSortBy(e.target.value as FeatureSort)}
                  aria-label="Sort features by"
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

        <main className="details-content flex flex-col flex-1 min-h-0 overflow-hidden">
          <section className="panel shrink-0">
            <div className="section-header flex items-center gap-2">
              <button
                type="button"
                className="collapse-toggle btn-icon"
                aria-expanded={isOverviewExpanded}
                aria-controls="overview-content"
                onClick={() => setIsOverviewExpanded((prev) => !prev)}
              >
                <IconChevron
                  className={`w-4 h-4 icon-chevron ${isOverviewExpanded ? 'expanded' : ''}`}
                />
              </button>
              <h2 className="section-title">Overview</h2>
              <div className="ml-auto" />
              <button
                type="button"
                className="btn-secondary btn-icon"
                aria-label="Edit story"
                onClick={handleEditStory}
              >
                <IconEdit className="w-4 h-4" />
              </button>
            </div>
            <div
              id="overview-content"
              className={`overview-content ${isOverviewExpanded ? 'expanded' : 'collapsed'}`}
            >
              <p className="story-desc">{story.description || 'No description provided.'}</p>
            </div>
          </section>

          <section className="panel flex flex-col flex-1 min-h-0">
            <div className="section-header shrink-0 flex items-center gap-2">
              <h2 className="section-title">Features</h2>
              <div className="ml-auto" />
              <button
                type="button"
                className="btn btn-icon"
                aria-label="Add feature"
                onClick={handleAddFeature}
              >
                <IconPlus className="w-4 h-4" />
              </button>
            </div>

            {featuresFiltered.length === 0 ? (
              <div className="flex-1 min-h-0 overflow-y-auto empty">No features found.</div>
            ) : (
              <ul
                className="flex-1 min-h-0 overflow-y-auto features-list"
                role="list"
                aria-label="Features"
                ref={ulRef}
              >
                {featuresFiltered.map((f) => {
                  const blockers = getBlockers(story.id, f.id)
                  const blockersOutbound = getBlockersOutbound(f.id)
                  const featureRun = runsActive.find((r) => r.context.featureId === f.id)
                  const featureHasActiveRun = !!featureRun
                  const fIdx = getFeatureIndex(story, f.id)
                  const rejection = (f as { rejection?: string }).rejection

                  return (
                    <li key={f.id} className="feature-item" role="listitem">
                      <div
                        className="feature-row"
                        role="button"
                        tabIndex={0}
                        data-feature-id={f.id}
                        onKeyDown={(e) => onRowKeyDown(e, f)}
                        onClick={(e) => {
                          const t = e.target as HTMLElement | null
                          if (t && t.closest('.no-drag')) return
                          handleEditFeature(f)
                        }}
                        aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}. ${blockers.length} blockers, ${blockersOutbound.length} outbound. Press Enter to edit.`}
                      >
                        <div className="col col-id">
                          <span className="id-chip">{fIdx}</span>
                          <StatusControl
                            status={f.status}
                            onChange={(next) =>
                              void handleFeatureStatusChange(story.id, f.id, next as Status)
                            }
                          />
                          {rejection && (
                            <ExclamationChip title={rejection} tooltip="Has rejection reason" />
                          )}
                        </div>

                        <div className="col col-title">
                          <span className="title-text">{f.title || ''}</span>
                        </div>
                        <div className="col col-description" title={f.description || ''}>
                          {f.description || ''}
                        </div>
                        <div
                          className={`col col-actions ${featureHasActiveRun ? 'is-sticky-visible' : ''}`}
                        >
                          {!storyHasActiveRun && !featureHasActiveRun && projectId && (
                            <div
                              className="no-drag"
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <RunAgentButton
                                projectId={projectId}
                                storyId={story.id}
                                featureId={f.id}
                              />
                            </div>
                          )}
                        </div>

                        <div
                          style={{ gridRow: 3, gridColumn: 2 }}
                          className="flex items-center justify-between gap-8"
                          aria-label={`Blockers and actions for Feature ${f.id}`}
                        >
                          <div className="flex gap-8">
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
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </main>

        {saving && (
          <div
            className="saving-indicator"
            aria-live="polite"
            style={{ position: 'fixed', bottom: 12, right: 16 }}
          >
            Reordering…
          </div>
        )}
      </div>

      {projectId && (
        <ChatSidebarPanel
          context={{ type: 'STORY', projectId, storyId: story.id }}
          chatContextTitle={story.title || `Story ${sIndex}`}
        />
      )}

      <StoriesModalHost route={modal} onClose={() => setModal(null)} />
    </div>
  )
}
