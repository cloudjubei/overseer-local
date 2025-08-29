import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { Task, Status } from 'src/types/tasks'
import { taskService } from '../services/taskService'
import type { TasksIndexSnapshot } from '../../types/external'
import { useNavigator } from '../navigation/Navigator'
import BoardView from './BoardView'
import SegmentedControl from '../components/ui/SegmentedControl'
import { useActiveProject } from '../projects/ProjectContext'
import DependencyBullet from '../components/tasks/DependencyBullet'
import StatusControl, { StatusPicker, statusKey } from '../components/tasks/StatusControl'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

function toTasksArray(index: TasksIndexSnapshot): Task[] {
  const tasksById = index.tasksById
  const byId: Record<string, Task> = tasksById as any
  return index.orderedIds.map((id) => byId[id]).filter(Boolean)
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
    const byStatus = !status || status === 'all' ? true : t.status === (status as Status)
    return byStatus && matchesQuery(t, query)
  })
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="8" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="20" y2="12"/><line x1="8" y1="18" x2="20" y2="18"/>
      <circle cx="4" cy="6" r="1.5"/><circle cx="4" cy="12" r="1.5"/><circle cx="4" cy="18" r="1.5"/>
    </svg>
  )
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="10" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/>
    </svg>
  )
}

const STATUS_ORDER = ['-', '~', '+', '=', '?']

export default function TasksListView() {
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'manual' | 'id_asc' | 'id_desc' | 'status'>('id_desc')
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'list' | 'board'>('list')
  const [dragTaskId, setDragTaskId] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const ulRef = useRef<HTMLUListElement>(null)
  const { openModal, navigateTaskDetails } = useNavigator()
  const { projectId } = useActiveProject()
  const [openFilter, setOpenFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  // Subscribe to tasks index updates and refresh when project context changes
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await taskService.getSnapshot()
        if (!cancelled) setIndex(idx)
      } catch (e) {
        console.error('Failed to load tasks index.', e)
      }
    })()
    const unsubscribe = taskService.onUpdate((idx) => {
      setIndex(idx)
    })
    return () => {
      cancelled = true
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [projectId])

  useEffect(() => {
    if (index) {
      setAllTasks(toTasksArray(index))
    } else {
      setAllTasks([])
    }
  }, [index])

  // Build a dependents map: key is dependency id (taskId or taskId.featureId), value is array of dependents (taskId or featureId strings)
  const globalDependents = useMemo(() => {
    const map: Record<string, string[]> = {}
    if (!index?.tasksById) return map
    Object.entries(index.tasksById).forEach(([tId, tsk]) => {
      const tid = parseInt(tId, 10)
      ;(tsk.dependencies || []).forEach((dep) => {
        if (!map[dep]) map[dep] = []
        map[dep].push(`${tid}`)
      })
      ;(tsk.features || []).forEach((f) => {
        ;(f.dependencies || []).forEach((dep) => {
          if (!map[dep]) map[dep] = []
          map[dep].push(`${f.id}`)
        })
      })
    })
    return map
  }, [index])

  // Keyboard shortcut: Cmd/Ctrl+N for new task
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        openModal({ type: 'task-create' })
      }
      // Quick toggle between list/board: Ctrl/Cmd+Shift+L or B
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'b')) {
        e.preventDefault()
        setView((v) => (v === 'list' ? 'board' : 'list'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openModal])

  const sorted = useMemo(() => {
    let tasks = [...allTasks]
    if (sortBy !== 'manual') {
      if (sortBy === 'id_asc') {
        tasks.sort((a, b) => (a.id || 0) - (b.id || 0))
      } else if (sortBy === 'id_desc') {
        tasks.sort((a, b) => (b.id || 0) - (a.id || 0))
      } else if (sortBy === 'status') {
        const sVal = (t: Task) => STATUS_ORDER.indexOf(t.status)
        tasks.sort((a, b) => sVal(a) - sVal(b) || (a.id || 0) - (b.id || 0))
      }
    }
    return tasks
  }, [allTasks, sortBy])

  const filtered = useMemo(() => filterTasks(sorted, { query, status: statusFilter }), [sorted, query, statusFilter])
  const isFiltered = query !== '' || statusFilter !== 'all'

  const handleAddTask = async () => {
    openModal({ type: 'task-create' })
  }

  const handleMoveTask = async (fromId: number, toIndex: number) => {
    if (saving) return
    setSaving(true)
    try {
      const res = await taskService.reorderTasks({ fromId, toIndex })
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder task: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (taskId: number, status: Status) => {
    try {
      await taskService.updateTask(taskId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const dndEnabled = sortBy === 'manual' && !isFiltered && view === 'list'

  const computeDropForRow = (e: React.DragEvent<HTMLElement>, idx: number) => {
    // Do not show drop indicators when hovering the dragged row itself
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    let pos: 'before' | 'after' | null = offsetY < rect.height / 2 ? 'before' : 'after'
    if (draggingIndex != null && (idx == draggingIndex || (idx == draggingIndex-1 && pos == 'after') || (idx == draggingIndex+1 && pos == 'before'))){
      pos = null
    }
    setDropIndex(idx)
    setDropPosition(pos)
  }

  const clearDndState = () => {
    setDragTaskId(null)
    setDragging(false)
    setDraggingIndex(null)
    setDropIndex(null)
    setDropPosition(null)
  }

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

  const onListDrop = () => {
    if (dragTaskId != null && dropIndex != null && dropPosition != null) {
      const fromIndex = allTasks.findIndex(t => t.id === dragTaskId)
      const toIndex = dropIndex //+ (dropPosition === 'after' ? 1 : 0)
      
      if (fromIndex !== -1 && toIndex !== fromIndex) {
        handleMoveTask(dragTaskId, toIndex)
      }
    }
    clearDndState()
  }

  const currentFilterLabel = statusFilter === 'all' ? 'All statuses' : `${STATUS_LABELS[statusFilter as Status]}`
  const k = statusFilter === 'all' ? 'queued' : statusKey(statusFilter as Status)

  return (
    <section className="flex flex-col flex-1 min-h-0 overflow-hidden" id="tasks-view" role="region" aria-labelledby="tasks-view-heading">
      <div className="tasks-toolbar shrink-0">
        <div className="left">
          <div className="control search-wrapper">
            <input id="tasks-search-input" type="search" placeholder="Search by id, title, or description" aria-label="Search tasks" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="control">
            <div
              ref={statusFilterRef}
              className="status-filter-btn ui-select gap-2"
              role="button"
              aria-haspopup="menu"
              aria-expanded={openFilter}
              aria-label="Filter by status"
              tabIndex={0}
              onClick={() => setOpenFilter(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpenFilter(true) }}
            >
              <span className={`status-bullet status-bullet--${k}`} aria-hidden />
              <span className="status-picker__label">{currentFilterLabel}</span>
            </div>
            {openFilter && statusFilterRef.current && (
              <StatusPicker 
                anchorEl={statusFilterRef.current} 
                value={statusFilter as Status}
                isAllAllowed={true}
                onSelect={(val) => { setStatusFilter(val); setOpenFilter(false); }}
                onClose={() => setOpenFilter(false)}
                />
            )}
          </div>
          <div className="control">
            <select className="ui-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort by">
              <option value="manual">Manual order</option>
              <option value="id_asc">ID ascending</option>
              <option value="id_desc">ID descending</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
        <div className="right">
          <SegmentedControl
            ariaLabel="Toggle between list and board views"
            options={[
              { value: 'list', label: 'List', icon: <ListIcon /> },
              { value: 'board', label: 'Board', icon: <BoardIcon /> },
            ]}
            value={view}
            onChange={(v) => setView(v as 'list' | 'board')}
            size="sm"
          />
          <Button onClick={handleAddTask}>New Task</Button>
        </div>
      </div>

      <div id="tasks-count" className="tasks-count shrink-0" aria-live="polite">
        Showing {filtered.length} of {allTasks.length} tasks
      </div>

      {view === 'board' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <BoardView tasks={filtered} />
        </div>
      ) : (
        <div id="tasks-results" className="flex-1 min-h-0 overflow-y-auto tasks-results" tabIndex={-1}>
          {filtered.length === 0 ? (
            <div className="empty">No tasks found.</div>
          ) : (
            <ul
              className={`tasks-list ${dragging ? 'dnd-active' : ''}`}
              role="list"
              aria-label="Tasks"
              ref={ulRef}
              onDragOver={(e) => {
                if (dndEnabled) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) =>{
                if (!dndEnabled || !dragging) return
                e.preventDefault()
                onListDrop()
              }}
              onDragEnd={() => clearDndState()}
            >
              {filtered.map((t, idx) => {
                const { done, total } = countFeatures(t)
                const isDragSource = dragTaskId === t.id
                const isDropBefore = dragging && dropIndex === idx && dropPosition === 'before'
                const isDropAfter = dragging && dropIndex === idx && dropPosition === 'after'
                const deps = Array.isArray(t.dependencies) ? t.dependencies : []
                const dependents = globalDependents[String(t.id)] || []
                return (
                  <li key={t.id} className="task-item" role="listitem">
                    {isDropBefore && <div className="drop-indicator" aria-hidden="true"></div>}
                    <div
                      className={`task-row ${dndEnabled ? 'draggable' : ''} ${isDragSource ? 'is-dragging' : ''} ${dragging && dropIndex === idx ? 'is-drop-target' : ''}`}
                      tabIndex={0}
                      role="button"
                      data-index={idx}
                      draggable={dndEnabled}
                      aria-grabbed={isDragSource}
                      onDragStart={(e) => {
                        if (!dndEnabled) return;
                        setDragTaskId(t.id);
                        setDragging(true);
                        setDraggingIndex(idx);
                        e.dataTransfer.setData('text/plain', String(t.id));
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => {
                        if (!dndEnabled) return; 
                        e.preventDefault();
                        computeDropForRow(e, idx);
                      }}
                      onClick={() => navigateTaskDetails(t.id)}
                      onKeyDown={(e) => onRowKeyDown(e, t.id)}
                      aria-label={`Task ${t.id}: ${t.title}. Description: ${t.description}. Status ${STATUS_LABELS[t.status as Status] || t.status}. Features ${done} of ${total} done. ${deps.length} dependencies this task is blocked by, ${dependents.length} dependencies this task is blocking. Press Enter to view details.`}
                    >
                      <div className="task-grid">

                        {/* <div className="col col-id"><span className="chips-sub__label">{String(t.id)}</span></div> */}

                        <div className="col col-id"><span className="id-chip">{String(t.id)}</span></div>
                        <div className="col col-title">
                          <div className="title-line">
                            <span className="title-text">{t.title || ''}</span>
                          </div>
                        </div>

                        <div className="col col-features flex justify-center">
                            <span className="chips-sub__label" title="No dependencies">{done}/{total}</span>
                        </div>
                        <div className="col col-desc">
                          <div className="desc-line" title={t.description || ''}>{t.description || ''}</div>
                        </div>
                        <div className="col col-status">
                          <StatusControl
                            status={t.status}
                            onChange={(next) => handleStatusChange(t.id, next)}
                          />
                        </div>
                      </div>
                      <div className="flex gap-8 ml-8" aria-label={`Dependencies for Task ${t.id}`}>
                        <div className="chips-list">
                          <span className="chips-sub__label">References</span>
                          {deps.length === 0 ? (
                            <span className="chips-sub__label" title="No dependencies">None</span>
                          ) : (
                            deps.map((d) => (
                              <DependencyBullet key={d} dependency={d} />
                            ))
                          )}
                        </div>
                        <div className="chips-list">
                          <span className="chips-sub__label">Blocks</span>
                          {dependents.length === 0 ? (
                            <span className="chips-sub__label" title="No dependents">None</span>
                          ) : (
                            dependents.map((d) => (
                                <DependencyBullet key={d} dependency={d} isInbound />
                            ))
                          )}
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

      {saving && <div className="saving-indicator" aria-live="polite" style={{ position: 'fixed', bottom: 12, right: 16 }}>Reordering…</div>}
    </section>
  )
}
