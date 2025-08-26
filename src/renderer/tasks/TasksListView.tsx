import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Task, Status } from 'src/types/tasks'
import { tasksService } from '../services/tasksService'
import type { TasksIndexSnapshot } from '../../types/external'
import { useNavigator } from '../navigation/Navigator'
import StatusBadge from '../components/tasks/StatusBadge'
import PriorityTag, { parsePriorityFromTitle } from '../components/tasks/PriorityTag'
import BoardView from './BoardView'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

const STATUSES: Status[] = ['+', '~', '-', '?', '=']

function toTasksArray(index: TasksIndexSnapshot): Task[] {
  const tasksById = index?.tasksById || {}
  const arr = Object.values(tasksById) as Task[]
  // Keep stable by orderedIds if provided; otherwise by id asc
  if (index?.orderedIds && Array.isArray(index.orderedIds)) {
    const byId: Record<number, Task> = tasksById as any
    return index.orderedIds.map((id) => byId[id]).filter(Boolean)
  }
  arr.sort((a, b) => (a.id || 0) - (b.id || 0))
  return arr
}

function countFeatures(task: Task) {
  const features = Array.isArray(task.features) ? task.features : []
  const total = features.length
  const done = features.filter((f) => f.status === '+').length
  return { done, total }
}

function matchesQuery(task: Task, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idStr = String(task.id || '')
  return idStr.includes(s) || task.title?.toLowerCase().includes(s) || task.description?.toLowerCase().includes(s)
}

function filterTasks(tasks: Task[], { query, status }: { query: string; status: string }) {
  return tasks.filter((t) => {
    const byStatus = !status || status === 'any' ? true : t.status === (status as Status)
    return byStatus && matchesQuery(t, query)
  })
}

export default function TasksListView() {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('any')
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [dragTaskId, setDragTaskId] = useState<number | null>(null)
  const ulRef = useRef<HTMLUListElement>(null)
  const { openModal, navigateTaskDetails } = useNavigator()

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const idx = await tasksService.getSnapshot()
        setIndex(idx)
        tasksService.onUpdate(setIndex)
      } catch (e) {
        console.error('Failed to load tasks index.', e)
      }
    }
    fetchIndex()
  }, [])

  useEffect(() => {
    if (index) {
      setAllTasks(toTasksArray(index))
    }
  }, [index])

  // Keyboard shortcut: Cmd/Ctrl+N for new task
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openModal({ type: 'task-create' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal])

  const filtered = useMemo(() => filterTasks(allTasks, { query, status: statusFilter }), [allTasks, query, statusFilter])
  const isFiltered = query !== '' || statusFilter !== 'any'

  const handleClear = () => {
    setQuery('')
    setStatusFilter('any')
  }

  const handleAddTask = async () => {
    openModal({ type: 'task-create' })
  }

  const handleMoveTask = async (fromId: number, toIndex: number) => {
    setSaving(true)
    try {
      const res = await tasksService.reorderTasks({ fromId, toIndex })
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder task: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (taskId: number, status: Status) => {
    try {
      await tasksService.updateTask(taskId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const dndEnabled = !isFiltered && view === 'list'

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, taskId: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigateTaskDetails(taskId)
      return
    }
    if (e.key.toLowerCase() === 's') {
      e.preventDefault()
      // cycle status quickly
      const current = allTasks.find(t => t.id === taskId)?.status
      const order: Status[] = ['-', '~', '+', '=', '?']
      const next = order[(Math.max(0, order.indexOf(current as Status)) + 1) % order.length]
      handleStatusChange(taskId, next)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const ul = ulRef.current
    if (!ul) return
    const rows = Array.from(ul.querySelectorAll('.task-row'))
    const current = e.currentTarget
    const i = rows.indexOf(current)
    if (i === -1) return
    let nextIndex = i + (e.key === 'ArrowDown' ? 1 : -1)
    if (nextIndex < 0) nextIndex = 0
    if (nextIndex >= rows.length) nextIndex = rows.length - 1
    ;(rows[nextIndex] as HTMLElement).focus()
  }

  return (
    <section id="tasks-view" role="region" aria-labelledby="tasks-view-heading">
      <div className="tasks-toolbar">
        <div className="left">
          <div className="control">
            <input id="tasks-search-input" type="search" placeholder="Search by id, title, or description" aria-label="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="control">
            <select id="tasks-status-select" className="ui-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="any">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]} ({s})
                </option>
              ))}
            </select>
          </div>
          <div className="control">
            <Button className="btn-clear" variant="secondary" onClick={handleClear}>Clear</Button>
          </div>
        </div>
        <div className="right">
          <div className="view-toggle" role="tablist" aria-label="View toggle">
            <button className={`toggle ${view === 'list' ? 'active' : ''}`} role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>List</button>
            <button className={`toggle ${view === 'board' ? 'active' : ''}`} role="tab" aria-selected={view === 'board'} onClick={() => setView('board')}>Board</button>
          </div>
          <Button onClick={handleAddTask}>New Task</Button>
        </div>
      </div>

      <div id="tasks-count" className="tasks-count" aria-live="polite">
        Showing {filtered.length} of {allTasks.length} tasks
      </div>

      {view === 'board' ? (
        <BoardView tasks={filtered} />
      ) : (
        <div id="tasks-results" className="tasks-results" tabIndex={-1}>
          {filtered.length === 0 ? (
            <div className="empty">No tasks found.</div>
          ) : (
            <ul className="tasks-list" role="list" aria-label="Tasks" ref={ulRef}
              onDragOver={(e) => { if (dndEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
            >
              {filtered.map((t, idx) => {
                const { done, total } = countFeatures(t)
                const priority = parsePriorityFromTitle(t.title)
                return (
                  <li key={t.id} className="task-item" role="listitem">
                    <div
                      className={`task-row ${dndEnabled ? 'draggable' : ''}`}
                      tabIndex={0}
                      role="button"
                      data-index={idx}
                      draggable={dndEnabled}
                      onDragStart={(e) => { if (!dndEnabled) return; setDragTaskId(t.id); e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => { if (!dndEnabled) return; e.preventDefault() }}
                      onDrop={(e) => { if (!dndEnabled) return; e.preventDefault(); const overIdx = idx; if (dragTaskId != null) { handleMoveTask(dragTaskId, overIdx) } setDragTaskId(null) }}
                      onClick={() => navigateTaskDetails(t.id)}
                      onKeyDown={(e) => onRowKeyDown(e, t.id)}
                      aria-label={`Task ${t.id}: ${t.title}. Status ${STATUS_LABELS[t.status as Status] || t.status}. Features ${done} of ${total} done. Press Enter to view details.`}
                    >
                      <div className="col col-id">{String(t.id)}</div>
                      <div className="col col-title">
                        <div className="title-line">
                          <span className="title-text">{t.title || ''}</span>
                          <PriorityTag priority={priority} />
                        </div>
                        <div className="desc-line" title={t.description || ''}>{t.description || ''}</div>
                      </div>
                      <div className="col col-status">
                        <div className="status-inline">
                          <StatusBadge status={t.status} />
                          <select className="status-select ui-select ui-select--sm" aria-label="Change status"
                            value={t.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleStatusChange(t.id, e.target.value as Status)}
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="col col-features">{done}/{total}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
