import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { Task, Status } from 'src/types/tasks'
import StatusBadge from '../components/tasks/StatusBadge'
import TaskCard from '../components/tasks/TaskCard'
import { tasksService } from '../services/tasksService'
import { useActiveProject } from '../projects/ProjectContext'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

type Props = {
  tasks: Task[]
}

export default function BoardView({ tasks }: Props) {
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const colRefs = useRef<Record<Status, HTMLDivElement | null>>({ '+': null, '~': null, '-': null, '?': null, '=': null })

  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const { projectId } = useActiveProject()

  const grouped = useMemo(() => {
    const map: Record<Status, Task[]> = { '+': [], '~': [], '-': [], '?': [], '=': [] }
    for (const t of tasks) { map[t.status].push(t) }
    for (const k of Object.keys(map) as Status[]) {
      map[k].sort((a, b) => (a.id || 0) - (b.id || 0))
    }
    return map
  }, [tasks])

  const totals = useMemo(() => {
    const res: Record<Status, number> = { '+': 0, '~': 0, '-': 0, '?': 0, '=': 0 }
    for (const s of STATUS_ORDER) res[s] = grouped[s].length
    return res
  }, [grouped])

  const onDragStart = (e: React.DragEvent, taskId: number) => {
    setDragId(taskId)
    e.dataTransfer.setData('text/plain', String(taskId))
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
    const fromId = idStr ? parseInt(idStr, 10) : dragId
    setDragOver(null)
    setDragId(null)
    if (!fromId) return
    // Update task status when moved between columns
    const task = tasks.find(t => t.id === fromId)
    if (!task || task.status === status) return
    try {
      await tasksService.updateTask(fromId, { status })
    } catch (err) {
      console.error('Failed to move task', err)
      alert('Failed to move task')
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
    // Re-evaluate when tasks or project changes (column counts/widths may shift)
  }, [tasks, projectId])

  const scrollByCols = (dir: -1 | 1) => {
    const el = viewportRef.current
    if (!el) return
    // Try to infer a column width from the first column; fallback to 320px
    const firstCol = el.querySelector('.board-col') as HTMLElement | null
    const step = firstCol?.offsetWidth || 320
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); scrollByCols(-1) }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollByCols(1) }
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

  const viewportClass = `board-viewport${canScrollLeft ? ' is-scroll-left' : ''}${canScrollRight ? ' is-scroll-right' : ''}`

  return (
    <div className={viewportClass} ref={viewportRef} onKeyDown={onKeyDown} onWheel={onWheel} tabIndex={0} role="region" aria-label="Board columns">
      {canScrollLeft && (
        <button className="board-nav board-nav--left" aria-label="Scroll left" onClick={() => scrollByCols(-1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
      )}
      {canScrollRight && (
        <button className="board-nav board-nav--right" aria-label="Scroll right" onClick={() => scrollByCols(1)}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
        </button>
      )}

      <div className="board" aria-label="Board view">
        {STATUS_ORDER.map((s) => (
          <div
            key={s}
            ref={(el) => { colRefs.current[s] = el }}
            className={`board-col ${dragOver === s ? 'drag-over' : ''} ${
              s === '+' ? 'board-col--status-done' : s === '~' ? 'board-col--status-inprogress' : s === '-' ? 'board-col--status-pending' : s === '?' ? 'board-col--status-blocked' : 'board-col--status-deferred'
            }`}
            onDragOver={(e) => onDragOverCol(e, s)}
            onDrop={(e) => onDropCol(e, s)}
            aria-label={`${STATUS_LABELS[s]} column`}
          >
            <div className={`board-col__header ${
              s === '+' ? 'header-done' : s === '~' ? 'header-inprogress' : s === '-' ? 'header-pending' : s === '?' ? 'header-blocked' : 'header-deferred'
            }`}>
              <div className="board-col__title">
                <StatusBadge status={s} /> {STATUS_LABELS[s]}
              </div>
              <div className="board-col__count">{totals[s]}</div>
            </div>
            <div className="board-col__body">
              {grouped[s].length === 0 ? (
                <div className="empty">No tasks</div>
              ) : (
                grouped[s].map((t) => (
                  <div key={t.id} draggable className="task-card" onDragStart={(e) => onDragStart(e, t.id)} aria-label={`Drag task ${t.id}`}>
                    <TaskCard task={t} />
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
