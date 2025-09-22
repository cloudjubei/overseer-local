import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Status, Story } from 'thefactory-tools'
import { useActiveProject } from '../contexts/ProjectContext'
import StatusControl from '../components/stories/StatusControl'
import { useNavigator } from '../navigation/Navigator'
import StoryCard from '../components/stories/StoryCard'
import { STATUS_LABELS } from '../utils/status'
import { useStories } from '../contexts/StoriesContext'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']

type Props = {
  stories: Story[]
}

export default function BoardView({ stories }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const colRefs = useRef<Record<Status, HTMLDivElement | null>>({
    '+': null,
    '~': null,
    '-': null,
    '?': null,
    '=': null,
  })

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const { project } = useActiveProject()
  const { navigateStoryDetails } = useNavigator()
  const { updateStory } = useStories()

  const grouped = useMemo(() => {
    const map: Record<Status, Story[]> = { '+': [], '~': [], '-': [], '?': [], '=': [] }
    for (const t of stories) {
      map[t.status].push(t)
    }
    for (const k of Object.keys(map) as Status[]) {
      map[k].sort(
        (a, b) =>
          (project?.storyIdToDisplayIndex[a.id] || 0) - (project?.storyIdToDisplayIndex[b.id] || 0),
      )
    }
    return map
  }, [stories, project])

  const totals = useMemo(() => {
    const res: Record<Status, number> = { '+': 0, '~': 0, '-': 0, '?': 0, '=': 0 }
    for (const s of STATUS_ORDER) res[s] = grouped[s].length
    return res
  }, [grouped])

  const onDragStart = (e: React.DragEvent, storyId: string) => {
    setDragId(storyId)
    e.dataTransfer.setData('text/plain', storyId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOverCol = (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(status)
  }

  const onDropCol = async (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    const idStr = e.dataTransfer.getData('text/plain')
    const fromId = idStr ? idStr : dragId
    setDragOver(null)
    setDragId(null)
    if (!fromId) return
    // Update story status when moved between columns
    const story = stories.find((t) => t.id === fromId)
    if (!story || story.status === status) return
    try {
      await updateStory(fromId, { status })
    } catch (err) {
      console.error('Failed to move story', err)
      alert('Failed to move story')
    }
  }

  // Horizontal scroll helpers (Linear/Monday-style)
  const updateScrollHints = () => {
    const el = viewportRef.current
    if (!el) return
    const left = el.scrollLeft > 1
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
    setCanScrollLeft(left)
    setCanScrollRight(right)
  }

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    updateScrollHints()
    const onScroll = () => updateScrollHints()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => updateScrollHints())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll as any)
      ro.disconnect()
    }
    // Re-evaluate when stories or project changes (column counts/widths may shift)
  }, [stories])

  useEffect(() => {
    viewportRef.current?.focus()
  }, [])

  const scrollByCols = (dir: -1 | 1) => {
    const el = viewportRef.current
    if (!el) return
    // Try to infer a column width from the first column; fallback to 320px
    const firstCol = el.querySelector('.board-col') as HTMLElement | null
    const step = firstCol?.offsetWidth || 320
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      scrollByCols(-1)
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      scrollByCols(1)
    }
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Shift + wheel scrolls horizontally (Monday/Linear pattern); allow native vertical inside columns
    if (e.shiftKey) {
      e.preventDefault()
      const el = viewportRef.current
      if (!el) return
      el.scrollBy({ left: e.deltaY, behavior: 'auto' })
    }
  }

  if (!project) {
    return (
      <div className="empty" aria-live="polite">
        Loading...
      </div>
    )
  }

  const viewportClass = `board-viewport${canScrollLeft ? ' is-scroll-left' : ''}${canScrollRight ? ' is-scroll-right' : ''}`

  return (
    <div
      className={viewportClass}
      ref={viewportRef}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      tabIndex={0}
      role="region"
      aria-label="Board columns"
    >
      {canScrollLeft && (
        <button
          className="board-nav board-nav--left"
          aria-label="Scroll left"
          onClick={() => scrollByCols(-1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          className="board-nav board-nav--right"
          aria-label="Scroll right"
          onClick={() => scrollByCols(1)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
          </svg>
        </button>
      )}

      <div className="board" aria-label="Board view">
        {STATUS_ORDER.map((s) => (
          <div
            key={s}
            ref={(el) => {
              colRefs.current[s] = el
            }}
            className={`board-col ${dragOver === s ? 'drag-over' : ''} ${
              s === '+'
                ? 'board-col--status-done'
                : s === '~'
                  ? 'board-col--status-inprogress'
                  : s === '-'
                    ? 'board-col--status-pending'
                    : s === '?'
                      ? 'board-col--status-blocked'
                      : 'board-col--status-deferred'
            }`}
            onDragOver={(e) => onDragOverCol(e, s)}
            onDrop={(e) => onDropCol(e, s)}
            aria-label={`${STATUS_LABELS[s]} column`}
          >
            <div
              className={`board-col__header ${
                s === '+'
                  ? 'header-done'
                  : s === '~'
                    ? 'header-inprogress'
                    : s === '-'
                      ? 'header-pending'
                      : s === '?'
                        ? 'header-blocked'
                        : 'header-deferred'
              }`}
            >
              <div className="board-col__title">
                <StatusControl status={s} />
              </div>
              <div className="board-col__count">{totals[s]}</div>
            </div>
            <div className="board-col__body">
              {grouped[s].length === 0 ? (
                <div className="empty">No stories</div>
              ) : (
                grouped[s].map((t) => (
                  <StoryCard
                    key={t.id}
                    project={project}
                    story={t}
                    draggable
                    onDragStart={(e) => onDragStart(e, t.id)}
                    onClick={() => navigateStoryDetails(t.id)}
                    showStatus={false}
                    onStatusChange={async (next) => {
                      try {
                        await updateStory(t.id, { status: next })
                      } catch (err) {
                        console.error('Failed to update status', err)
                      }
                    }}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
