import React, { useEffect, useState, useRef } from 'react'
import { Button } from '../components/ui/button'
import { Task, Status } from 'src/types/tasks'
import { tasksService } from '../services/tasksService'
import type { TasksIndexSnapshot } from '../types/external'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

const STATUSES: Status[] = Object.keys(STATUS_LABELS) as Status[]

function toTasksArray(index: TasksIndexSnapshot): Task[] {
  const tasksById = index?.tasksById || {}
  const arr = Object.values(tasksById) as Task[]
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

function cssStatus(status: Status | string) {
  switch (status) {
    case '+': return 'done'
    case '~': return 'inprogress'
    case '-': return 'pending'
    case '?': return 'blocked'
    case '=': return 'deferred'
    default: return 'unknown'
  }
}

function StatusBadge({ status }: { status: Status | string }) {
  const label = STATUS_LABELS[status as Status] || String(status || '')
  return (
    <span className={`status-badge status-${cssStatus(status)}`} role="img" aria-label={label}>
      {label}
    </span>
  )
}

function onRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>, taskId: number, ulRef: React.RefObject<HTMLUListElement>) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    location.hash = `#task/${taskId}`
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

export default function TasksListView() {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('any')
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const ulRef = useRef<HTMLUListElement>(null)

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

  const filtered = filterTasks(allTasks, { query, status: statusFilter })
  const isFiltered = query !== '' || statusFilter !== 'any'

  const handleClear = () => {
    setQuery('')
    setStatusFilter('any')
  }

  const handleAddTask = async () => {
    try {
      await window.tasksIndex.openTaskCreate()
    } catch (e) {
      console.error(e)
    }
  }

  const handleMoveTask = async (fromId: number, toIndex: number) => {
    setSaving(true)
    try {
      const res = await window.tasksIndex.reorderTasks({ fromId, toIndex })
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder task: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="tasks-view" role="region" aria-labelledby="tasks-view-heading">
      <div className="tasks-controls" role="search">
        <div className="control">
          <label htmlFor="tasks-search-input">Search</label>
          <input id="tasks-search-input" type="search" placeholder="Search by id, title, or description" aria-label="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="control">
          <label htmlFor="tasks-status-select">Status</label>
          <select id="tasks-status-select" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="any">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]} ({s})
              </option>
            ))}
          </select>
        </div>
        <div className="control control-Buttons">
          <Button className="btn-clear" onClick={handleClear}>
            Clear
          </Button>
        </div>
        <div className="control control-add-task">
          <Button className="btn-add-task" onClick={handleAddTask}>
            Add Task
          </Button>
        </div>
      </div>
      <div id="tasks-count" className="tasks-count" aria-live="polite">
        Showing {filtered.length} of {allTasks.length} tasks
      </div>
      <div id="tasks-results" className="tasks-results" tabIndex={-1}>
        {filtered.length === 0 ? (
          <div className="empty">No tasks found.</div>
        ) : (
          <ul className="tasks-list" role="list" aria-label="Tasks" ref={ulRef}>
            {filtered.map((t, idx) => {
              const { done, total } = countFeatures(t)
              return (
                <li key={t.id} className="task-item" role="listitem">
                  <div
                    className="task-row"
                    tabIndex={0}
                    role="Button"
                    data-index={idx}
                    onClick={() => (location.hash = `#task/${t.id}`)}
                    onKeyDown={(e) => onRowKeyDown(e, t.id, ulRef)}
                    aria-label={`Task ${t.id}: ${t.title}. Status ${STATUS_LABELS[t.status as Status] || t.status}. Features ${done} of ${total} done. Press Enter to view details.`}
                  >
                    <div className="col col-id">{String(t.id)}</div>
                    <div className="col col-title">{t.title || ''}</div>
                    <div className="col col-status">
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="col col-features">{done}/{total}</div>
                    {!isFiltered && (
                      <div className="col col-actions">
                        <Button className="btn-move-up" disabled={saving || idx === 0} onClick={(e) => { e.stopPropagation(); handleMoveTask(t.id, idx - 1) }}>Up</Button>
                        <Button className="btn-move-down" disabled={saving || idx === filtered.length - 1} onClick={(e) => { e.stopPropagation(); handleMoveTask(t.id, idx + 1) }}>Down</Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
