import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, Status, Task } from 'src/types/tasks'
import { tasksService } from '../services/tasksService'
import type { TasksIndexSnapshot } from '../../types/external'
import { useNavigator } from '../navigation/Navigator'
import StatusBadge from '../components/tasks/StatusBadge'
import StatusBullet from '../components/tasks/StatusBullet'
import DependencyBullet from '../components/tasks/DependencyBullet'
import { useActiveProject } from '../projects/ProjectContext'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  )
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  )
}

function IconExclamation({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

export default function TaskDetailsView({ taskId }: { taskId: number }) {
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const { openModal, navigateView, tasksRoute } = useNavigator()
  const ulRef = useRef<HTMLUListElement>(null)
  const { projectId } = useActiveProject()

  // DnD state (match Tasks list patterns)
  const [dragFeatureId, setDragFeatureId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const idx = await tasksService.getSnapshot()
        if (!cancelled) setIndex(idx)
      } catch (e) {
        console.error('Failed to load tasks index.', e)
      }
    })()
    const unsubscribe = tasksService.onUpdate((idx) => setIndex(idx))
    return () => {
      cancelled = true
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [projectId])

  useEffect(() => {
    if (taskId && index && (index as any).tasksById) {
      const t = (index as any).tasksById?.[taskId]
      setTask(t || null)
    } else {
      setTask(null)
    }
  }, [taskId, index])

  const globalDependents = useMemo(() => {
    const map: Record<string, string[]> = {}
    if (!index?.tasksById) return map
    Object.entries(index.tasksById).forEach(([tId, tsk]) => {
      const taskId = parseInt(tId, 10);
      (tsk.dependencies || []).forEach(dep => {
        if (!map[dep]) map[dep] = []
        map[dep].push(`${taskId}`)
      });
      tsk.features.forEach(f => {
        (f.dependencies || []).forEach(dep => {
          if (!map[dep]) map[dep] = []
          map[dep].push(`${f.id}`)
        })
      });
    })
    return map
  }, [index])

  const handleEditTask = () => { if (!task) return; openModal({ type: 'task-edit', taskId: task.id }) }
  const handleAddFeature = () => { if (!task) return; openModal({ type: 'feature-create', taskId: task.id }) }
  const handleEditFeature = (featureId: string) => { if (!task) return; openModal({ type: 'feature-edit', taskId: task.id, featureId }) }

  const handleTaskStatusChange = async (taskId: number, status: Status) => {
    try {
      await tasksService.updateTask(taskId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }
  const handleFeatureStatusChange = async (taskId: number, featureId: string, status: Status) => {
    try {
      await tasksService.updateFeature(taskId, featureId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const handleMoveFeature = async (fromId: string, toIndex: number) => {
    if (!task) return
    setSaving(true)
    try {
      const res = await tasksService.reorderFeatures(task.id, { fromId, toIndex })
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder feature: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const computeDropForRow = (e: React.DragEvent<HTMLElement>, idx: number) => {
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
    setDragFeatureId(null)
    setDragging(false)
    setDraggingIndex(null)
    setDropIndex(null)
    setDropPosition(null)
  }

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, featureId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditFeature(featureId)
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

  const highlightFeatureId = tasksRoute.name === 'details' && tasksRoute.taskId === taskId ? tasksRoute.highlightFeatureId : undefined
  const highlightTaskFlag = tasksRoute.name === 'details' && tasksRoute.taskId === taskId ? tasksRoute.highlightTask : undefined

  useEffect(() => {
    if (highlightFeatureId) {
      const row = document.querySelector(`.feature-row[data-feature-id="${highlightFeatureId}"]`)
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.classList.add('highlighted')
        setTimeout(() => row.classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightFeatureId])

  useEffect(() => {
    if (highlightTaskFlag) {
      const element = document.querySelector('.details-header')
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' });
        element.classList.add('highlighted')
        setTimeout(() => element.classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightTaskFlag])

  if (!task) {
    return (
      <div className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <header className="details-header shrink-0">
          <div className="details-header__bar">
            <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }}>
              <IconBack />
              <span className="sr-only">Back to Tasks</span>
            </button>
            <h1 className="details-title">Task {taskId}</h1>
          </div>
        </header>
        <main className="details-content flex-1 min-h-0 overflow-auto p-4">
          <div className="empty">Task {taskId} not found.</div>
        </main>
      </div>
    )
  }

  const dndEnabled = !saving

  const onListDrop = () => {
    if (dragFeatureId != null && dropIndex != null && dropPosition != null) {
      const toIndex = dropIndex + (dropPosition === 'after' ? 1 : 0)
      handleMoveFeature(dragFeatureId, toIndex)
    }
    clearDndState()
  }

  return (
    <div  className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden" role="region" aria-labelledby="task-details-heading">
      <header className="details-header shrink-0">
        <div className="details-header__bar">
          <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }} aria-label="Back to Tasks">
            <IconBack />
          </button>
          <h1 id="task-details-heading" className="details-title">{task.title || `Task ${task.id}`}</h1>
          <div className="status-inline">
            <StatusBadge status={task.status} variant="bold" className="ml-2" />
            <StatusBullet
              status={task.status}
              onChange={(next) => handleTaskStatusChange(task.id, next)}
              className="reveal-on-hover"
            />
          </div>
          <div className="spacer" />
        </div>
        <div className="details-header__meta">
          <span className="meta-item"><span className="meta-label">ID</span><span className="meta-value">{String(task.id)}</span></span>
          <span className="meta-item"><span className="meta-label">Status</span><span className="meta-value">{STATUS_LABELS[task.status as Status] || String(task.status)}</span></span>
          <span className="meta-item"><span className="meta-label">Features</span><span className="meta-value">{task.features.length}</span></span>
        </div>
      </header>

      <main className="details-content flex flex-col flex-1 min-h-0 overflow-hidden">
        <section className="panel shrink-0">
          <div className="section-header">
            <h2 className="section-title">Overview</h2>
            <div className="section-actions">
              <button type="button" className="btn-secondary btn-icon" aria-label="Edit task" onClick={handleEditTask}>
                <IconEdit />
              </button>
            </div>
          </div>
          <p className="task-desc">{task.description || 'No description provided.'}</p>
        </section>

        <section className="panel flex flex-col flex-1 min-h-0">
          <div className="section-header shrink-0">
            <h2 className="section-title">Features</h2>
            <div className="section-actions">
              <button type="button" className="btn btn-icon" aria-label="Add feature" onClick={handleAddFeature}>
                <IconPlus />
              </button>
            </div>
          </div>

          {task.features.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto empty">No features defined for this task.</div>
          ) : (
            <ul
              className={`flex-1 min-h-0 overflow-y-auto features-list ${dragging ? 'dnd-active' : ''}`}
              role="list"
              aria-label="Features"
              ref={ulRef}
              onDragOver={(e) => { if (dndEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
              onDrop={(e) =>{
                if (!dndEnabled || !dragging) return
                e.preventDefault()
                onListDrop()
              }}
              onDragEnd={() => clearDndState()}
            >
              <li className="features-head" aria-hidden="true">
                <div className="col col-id"></div>
                <div className="col col-title">Title</div>
                <div className="col col-status">Status</div>
                <div className="col col-deps">Dependencies</div>
                <div className="col col-actions"></div>
              </li>
              {task.features.map((f: Feature, idx: number) => {
                const deps = Array.isArray(f.dependencies) ? f.dependencies : []
                const fullId = `${f.id}`
                const dependents = globalDependents[fullId] || []

                const isDragSource = dragFeatureId === f.id
                const isDropBefore = dragging && dropIndex === idx && dropPosition === 'before'
                const isDropAfter = dragging && dropIndex === idx && dropPosition === 'after'
                return (
                  <li key={f.id} className="feature-item" role="listitem">
                    {isDropBefore && <div className="drop-indicator" aria-hidden="true"></div>}
                    <div
                      className={`feature-row ${dndEnabled ? 'draggable' : ''} ${isDragSource ? 'is-dragging' : ''} ${dragging && dropIndex === idx ? 'is-drop-target' : ''} ${f.id === highlightFeatureId ? 'highlighted' : ''}`}
                      role="button"
                      tabIndex={0}
                      data-index={idx}
                      data-feature-id={f.id}
                      draggable={dndEnabled}
                      aria-grabbed={isDragSource}
                      onDragStart={(e) => {
                        if (!dndEnabled) return
                        setDragFeatureId(f.id)
                        setDragging(true)
                        setDraggingIndex(idx)
                        e.dataTransfer.setData('text/plain', String(f.id))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => { if (!dndEnabled) return; e.preventDefault(); computeDropForRow(e, idx) }}
                      onKeyDown={(e) => onRowKeyDown(e, f.id)}
                      aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}. ${deps.length} dependencies, ${dependents.length} dependents. Press Enter to edit.`}
                    >
                      <div className="col col-id flex flex-col items-center gap-1">
                          {f.rejection && (
                            <span className="rejection-badge" aria-label="Has rejection reason" title={f.rejection}>
                              <IconExclamation className="w-4 h-4" />
                            </span>
                          )}
                        <span className="id-chip">{f.id || ''}</span>
                      </div>
                      <div className="col col-title">
                        <div className="title-line"><span className="title-text">{f.title || ''}</span></div>
                        <div className="desc-line" title={f.description || ''}>{f.description || ''}</div>
                      </div>
                      <div className="col col-status">
                        <div className="status-inline">
                          <StatusBadge status={f.status} />
                          <StatusBullet
                            status={f.status}
                            onChange={(next) => handleFeatureStatusChange(task.id, f.id, next)}
                            className="reveal-on-hover"
                          />
                        </div>
                      </div>
                      <div className="col col-deps">
                        <div className="chips-list" aria-label={`Dependencies for ${f.id}`}>
                          {deps.length === 0 ? (
                            <span className="chip chip--none" title="No dependencies">None</span>
                          ) : (
                            deps.map((d) => (
                              <DependencyBullet key={d} dependency={d}/>
                            ))
                          )}
                        </div>
                        
                        {dependents.length > 0 && (
                          <div className="chips-sub" aria-label={`Dependents of ${f.id}`}>
                            <span className="chips-sub__label">Blocks</span>
                            {dependents.map((d) => (
                              <DependencyBullet key={d} dependency={d} isInbound/>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col col-actions">
                        <div className="row-actions">
                          <button type="button" className="btn-secondary btn-icon" aria-label="Edit feature" onClick={() => handleEditFeature(f.id)}>
                            <IconEdit />
                          </button>
                        </div>
                      </div>
                    </div>
                    {isDropAfter && <div className="drop-indicator" aria-hidden="true"></div>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      {saving && <div className="saving-indicator" aria-live="polite" style={{ position: 'fixed', bottom: 12, right: 16 }}>Reordering…</div>}
    </div>
  )
}
