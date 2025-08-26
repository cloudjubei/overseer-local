import { useEffect, useState } from 'react'
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

  const features = task.features || []

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
            <ul className="features-list" role="list" aria-label="Features">
              <li className="features-head" aria-hidden="true">
                <div className="col col-id">ID</div>
                <div className="col col-title">Title</div>
                <div className="col col-status">Status</div>
                <div className="col col-actions">Actions</div>
              </li>
              {features.map((f: Feature, idx: number) => (
                <li key={f.id} className="feature-item" role="listitem">
                  <div className="feature-row" role="group" aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}`}>
                    <div className="col col-id">{f.id || ''}</div>
                    <div className="col col-title">{f.title || ''}</div>
                    <div className="col col-status"><StatusBadge status={f.status} variant="soft" /></div>
                    <div className="col col-actions">
                      <button type="button" className="btn-secondary" onClick={() => handleEditFeature(f.id)}>Edit</button>
                      <div className="row-actions">
                        <button type="button" className="btn-secondary" disabled={idx === 0 || saving} onClick={() => handleMoveFeature(f.id, idx - 1)}>Up</button>
                        <button type="button" className="btn-secondary" disabled={idx === features.length - 1 || saving} onClick={() => handleMoveFeature(f.id, idx + 1)}>Down</button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
