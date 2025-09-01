import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, ProjectSpec, Status, Task } from 'src/types/tasks'
import { useNavigator } from '../navigation/Navigator'
import DependencyBullet from '../components/tasks/DependencyBullet'
import { useActiveProject } from '../projects/ProjectContext'
import StatusControl from '../components/tasks/StatusControl'
import { STATUS_LABELS } from '../services/tasksService';
import { useTasks } from '../hooks/useTasks'


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

function IconChevron({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  )
}

export default function TaskDetailsView({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const { openModal, navigateView, tasksRoute } = useNavigator()
  const ulRef = useRef<HTMLUListElement>(null)
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(true)

  // DnD state (match Tasks list patterns)
  const [dragFeatureId, setDragFeatureId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const { project } = useActiveProject()
  const { tasksById, updateTask, updateFeature, reorderFeatures, getReferencesInbound, getReferencesOutbound } = useTasks()


  useEffect(() => {
    if (taskId && tasksById) {
      const t = tasksById[taskId]
      setTask(t)
    } else {
      setTask(null)
    }
  }, [taskId, tasksById])

  const sortedFeatures = useMemo(() => {
    if (!task) { return []}
    return task.features.sort((a,b) => task.featureIdToDisplayIndex[a.id] - task.featureIdToDisplayIndex[b.id])
  }, [task, tasksById])

  const handleEditTask = () => { if (!task) return; openModal({ type: 'task-edit', taskId: task.id }) }
  const handleAddFeature = () => { if (!task) return; openModal({ type: 'feature-create', taskId: task.id }) }
  const handleEditFeature = (featureId: string) => { if (!task) return; openModal({ type: 'feature-edit', taskId: task.id, featureId }) }

  const handleTaskStatusChange = async (taskId: string, status: Status) => {
    try {
      await updateTask(taskId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }
  const handleFeatureStatusChange = async (taskId: string, featureId: string, status: Status) => {
    try {
      await updateFeature(taskId, featureId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const handleMoveFeature = async (fromIndex: number, toIndex: number) => {
    if (!task) return
    setSaving(true)
    try {
      const res = await reorderFeatures(task.id, fromIndex, toIndex)
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
    if (dragFeatureId != null && draggingIndex != null && dropIndex != null && dropPosition != null) {
      const toIndex = dropIndex + (dropPosition === 'after' ? 1 : 0)
      handleMoveFeature(draggingIndex, toIndex)
    }
    clearDndState()
  }

  const taskDependenciesInbound = getReferencesInbound(task.id)
  const taskDependenciesOutbound = getReferencesOutbound(task.id)

  return (
    <div  className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden" role="region" aria-labelledby="task-details-heading">
      <header className="details-header shrink-0">
        <div className="details-header__bar">
          <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }} aria-label="Back to Tasks">
            <IconBack />
          </button>

          <div className="col col-id flex flex-col items-center gap-1" style={{ gridRow: '1 / 4', alignSelf: 'center' }}>
            <span className="id-chip">{project?.taskIdToDisplayIndex[task.id] ?? 0}</span>
            <StatusControl
              status={task.status}
              className="ml-2"
              onChange={(next) => handleTaskStatusChange(task.id, next)}
            />
          </div>
          
          <h1 id="task-details-heading" className="details-title">{task.title || `Task ${task.id}`}</h1>
          
          <div className="flex gap-4 ml-2" aria-label={`Dependencies for Task ${task.id}`}>
            <div className="chips-list">
              <span className="chips-sub__label">References</span>
              {taskDependenciesInbound.length === 0 ? (
                <span className="chips-sub__label" title="No dependencies">None</span>
              ) : (
                taskDependenciesInbound.map((d) => (
                  <DependencyBullet key={d.id} dependency={d.id} />
                ))
              )}
            </div>
            <div className="chips-list">
              <span className="chips-sub__label">Blocks</span>
              {taskDependenciesOutbound.length === 0 ? (
                <span className="chips-sub__label" title="No dependents">None</span>
              ) : (
                taskDependenciesOutbound.map((d) => (
                    <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                ))
              )}
            </div>
          </div>
          <div className="spacer" />
        </div>
      </header>

      <main className="details-content flex flex-col flex-1 min-h-0 overflow-hidden">
        <section className="panel shrink-0">
          <div className="section-header">
            <button
              type="button"
              className="collapse-toggle btn-icon"
              aria-expanded={isOverviewExpanded}
              aria-controls="overview-content"
              onClick={() => setIsOverviewExpanded((prev) => !prev)}
            >
              <IconChevron className={`icon-chevron ${isOverviewExpanded ? 'expanded' : ''}`} />
            </button>
            <h2 className="section-title">Overview</h2>
            <div className="section-actions">
              <button type="button" className="btn-secondary btn-icon" aria-label="Edit task" onClick={handleEditTask}>
                <IconEdit />
              </button>
            </div>
          </div>
          <div id="overview-content" className={`overview-content ${isOverviewExpanded ? 'expanded' : 'collapsed'}`}>
            <p className="task-desc">{task.description || 'No description provided.'}</p>
          </div>
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

          {sortedFeatures.length === 0 ? (
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
              {sortedFeatures.map((f: Feature, idx: number) => {
                const dependenciesInbound = getReferencesInbound(task.id, f.id)
                const dependenciesOutbound = getReferencesOutbound(f.id)

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
                      aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}. ${dependenciesOutbound.length} dependencies, ${dependenciesInbound.length} dependents. Press Enter to edit.`}
                    >
                      <div className="col col-id flex flex-col items-center gap-1" style={{ gridRow: '1 / 4', alignSelf: 'center' }}>
                        {f.rejection && (
                          <span className="rejection-badge" aria-label="Has rejection reason" title={f.rejection}>
                            <IconExclamation className="w-4 h-4" />
                          </span>
                        )}
                        <span className="id-chip">{task.featureIdToDisplayIndex[f.id]}</span>
                        <StatusControl
                          status={f.status}
                          onChange={(next) => handleFeatureStatusChange(task.id, f.id, next)}
                        />
                      </div>
                      <div className="title-line" style={{ gridRow: 1, gridColumn: 2 }}>
                        <span className="title-text">{f.title || ''}</span>
                      </div>
                      <div className="desc-line" style={{ gridRow: 2, gridColumn: 2 }} title={f.description || ''}>
                        {f.description || ''}
                      </div>
                      <div className="col col-actions" style={{ gridRow: 2, gridColumn: 3 }}>
                        <div className="row-actions">
                          <button type="button" className="btn-secondary btn-icon" aria-label="Edit feature" onClick={() => handleEditFeature(f.id)}>
                            <IconEdit />
                          </button>
                        </div>
                      </div>

                      <div style={{ gridRow: 3, gridColumn: 2 }} className="flex gap-8" aria-label={`Dependencies for Feature ${f.id}`}>
                        <div className="chips-list">
                          <span className="chips-sub__label">References</span>
                          {dependenciesInbound.length === 0 ? (
                            <span className="chips-sub__label" title="No dependencies">None</span>
                          ) : (
                            dependenciesInbound.map((d) => (
                              <DependencyBullet key={d.id} dependency={d.id} />
                            ))
                          )}
                        </div>
                        <div className="chips-list">
                          <span className="chips-sub__label">Blocks</span>
                          {dependenciesOutbound.length === 0 ? (
                            <span className="chips-sub__label" title="No dependents">None</span>
                          ) : (
                            dependenciesOutbound.map((d) => (
                              <DependencyBullet key={d.id} dependency={d.id} isOutbound />
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
        </section>
      </main>

      {saving && <div className="saving-indicator" aria-live="polite" style={{ position: 'fixed', bottom: 12, right: 16 }}>Reordering…</div>}
    </div>
  )
}
