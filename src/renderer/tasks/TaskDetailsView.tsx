import { useEffect, useMemo, useRef, useState } from 'react'
import type { Feature, Status, Task } from 'src/types/tasks'
import { tasksService } from '../services/tasksService'
import type { TasksIndexSnapshot } from '../../types/external'
import { useNavigator } from '../navigation/Navigator'
import StatusBadge from '../components/tasks/StatusBadge'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

export default function TaskDetailsView({ taskId }: { taskId: number }) {
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const { openModal, navigateView } = useNavigator()
  const ulRef = useRef<HTMLUListElement>(null)
  const [dragFeatureId, setDragFeatureId] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    const fetchIndex = async () => {
      try {
        const idx = await tasksService.getSnapshot()
        setIndex(idx)
        unsubscribe = tasksService.onUpdate(setIndex)
      } catch (e) {
        console.error(e)
      }
    }
    fetchIndex()
    return () => { if (unsubscribe) unsubscribe() }
  }, [])

  useEffect(() => {
    if (taskId && index && index.tasksById) {
      const t = index.tasksById?.[taskId]
      setTask(t || null)
    }
  }, [taskId, index])

  const handleEditTask = () => { if (!task) return; openModal({ type: 'task-edit', taskId: task.id }) }
  const handleAddFeature = () => { if (!task) return; openModal({ type: 'feature-create', taskId: task.id }) }
  const handleEditFeature = (featureId: string) => { if (!task) return; openModal({ type: 'feature-edit', taskId: task.id, featureId }) }

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

  if (!task) {
    return (
      <div className="task-details flex flex-col min-h-0 w-full">
        <header className="details-header shrink-0">
          <div className="details-header__bar">
            <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }}>Back to Tasks</button>
            <h1 className="details-title">Task {taskId}</h1>
          </div>
        </header>
        <main className="details-content flex-1 min-h-0 overflow-auto p-4">
          <div className="empty">Task {taskId} not found.</div>
        </main>
      </div>
    )
  }

  const features = Array.isArray(task.features) ? task.features : []

  // Build dependency maps for quick lookups
  const { featuresById, dependentsMap } = useMemo(() => {
    const byId: Record<string, Feature> = {}
    const deps: Record<string, string[]> = {}
    for (const f of features) {
      byId[f.id] = f
    }
    for (const f of features) {
      const depsOfF = Array.isArray(f.dependencies) ? f.dependencies : []
      for (const dep of depsOfF) {
        if (!deps[dep]) deps[dep] = []
        deps[dep].push(f.id)
      }
    }
    return { featuresById: byId, dependentsMap: deps }
  }, [features])

  const dndEnabled = !saving

  return (
    <div className="task-details flex flex-col min-h-0 w-full" role="region" aria-labelledby="task-details-heading">
      <header className="details-header shrink-0">
        <div className="details-header__bar">
          <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }}>Back</button>
          <h1 id="task-details-heading" className="details-title">{task.title || `Task ${task.id}`}</h1>
          <StatusBadge status={task.status} variant="bold" className="ml-2" />
          <div className="spacer" />
          <button type="button" className="btn-secondary" onClick={handleEditTask}>Edit Task</button>
          <button type="button" className="btn" onClick={handleAddFeature}>Add Feature</button>
        </div>
        <div className="details-header__meta">
          <span className="meta-item"><span className="meta-label">ID</span><span className="meta-value">{String(task.id)}</span></span>
          <span className="meta-item"><span className="meta-label">Status</span><span className="meta-value">{STATUS_LABELS[task.status as Status] || String(task.status)}</span></span>
          <span className="meta-item"><span className="meta-label">Features</span><span className="meta-value">{features.length}</span></span>
        </div>
      </header>

      <main className="details-content flex-1 min-h-0 overflow-auto">
        <section className="panel">
          <h2 className="section-title">Overview</h2>
          <p className="task-desc">{task.description || 'No description provided.'}</p>
        </section>

        <section className="panel">
          <div className="section-header">
            <h2 className="section-title">Features</h2>
            <div className="section-actions">
              <button type="button" className="btn" onClick={handleAddFeature}>Add Feature</button>
            </div>
          </div>

          {features.length === 0 ? (
            <div className="empty">No features defined for this task.</div>
          ) : (
            <ul className="features-list" role="list" aria-label="Features" ref={ulRef}
              onDragOver={(e) => { if (dndEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
            >
              <li className="features-head" aria-hidden="true">
                <div className="col col-id">ID</div>
                <div className="col col-title">Title</div>
                <div className="col col-status">Status</div>
                <div className="col col-deps">Dependencies</div>
                <div className="col col-actions">Actions</div>
              </li>
              {features.map((f: Feature, idx: number) => {
                const deps = Array.isArray(f.dependencies) ? f.dependencies : []
                const dependents = dependentsMap[f.id] || []
                return (
                  <li key={f.id} className="feature-item" role="listitem">
                    <div
                      className={`feature-row ${dndEnabled ? 'draggable' : ''}`}
                      role="button"
                      tabIndex={0}
                      data-index={idx}
                      draggable={dndEnabled}
                      onDragStart={(e) => { if (!dndEnabled) return; setDragFeatureId(f.id); e.dataTransfer.setData('text/plain', String(f.id)); e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => { if (!dndEnabled) return; e.preventDefault() }}
                      onDrop={(e) => { if (!dndEnabled) return; e.preventDefault(); const overIdx = idx; if (dragFeatureId != null) { handleMoveFeature(dragFeatureId, overIdx) } setDragFeatureId(null) }}
                      onKeyDown={(e) => onRowKeyDown(e, f.id)}
                      aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}. ${deps.length} dependencies, ${dependents.length} dependents. Press Enter to edit.`}
                    >
                      <div className="col col-id">{f.id || ''}</div>
                      <div className="col col-title">
                        <div className="title-line"><span className="title-text">{f.title || ''}</span></div>
                        <div className="desc-line" title={f.description || ''}>{f.description || ''}</div>
                      </div>
                      <div className="col col-status"><StatusBadge status={f.status} variant="soft" /></div>
                      <div className="col col-deps">
                        <div className="deps-list" aria-label={`Dependencies for ${f.id}`}>
                          {deps.length === 0 ? (
                            <span className="dep-chip dep-chip--none" title="No dependencies">None</span>
                          ) : (
                            deps.map((d) => (
                              <span key={d} className={`dep-chip ${featuresById[d] ? 'dep-chip--ok' : 'dep-chip--missing'}`} title={featuresById[d] ? `Depends on ${d}` : `Missing dependency ${d}`}>
                                {d}
                              </span>
                            ))
                          )}
                        </div>
                        {dependents.length > 0 && (
                          <div className="deps-sub" aria-label={`Dependents of ${f.id}`}>
                            <span className="deps-sub__label">Blocks</span>
                            {dependents.map((d) => (
                              <span key={d} className="dep-chip dep-chip--blocks" title={`Blocks ${d}`}>{d}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="col col-actions">
                        <button type="button" className="btn-secondary" onClick={() => handleEditFeature(f.id)}>Edit</button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
