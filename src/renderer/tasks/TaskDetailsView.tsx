import { useEffect, useState } from 'react'
import type { Feature, Status, Task } from 'src/types/tasks'
import { tasksService } from '../services/tasksService'
import type { TasksIndexSnapshot } from '../../types/external'
import { useNavigator } from '../navigation/Navigator'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

const STATUS_OPTIONS: Status[] = ['+', '~', '-', '?', '=']

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
  return <span className={`status-badge status-${cssStatus(status)}`} role="img" aria-label={label}>{label}</span>
}


export default function TaskDetailsView({ taskId }: { taskId: number }) {
  const [index, setIndex] = useState<TasksIndexSnapshot | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const { openModal, navigateView } = useNavigator()

  useEffect(() => {
    const fetchIndex = async () => {
      try {
        const idx = await tasksService.getSnapshot()
        setIndex(idx)
        tasksService.onUpdate(setIndex)
      } catch (e) {
        console.error(e)
      }
    }
    fetchIndex()
  }, [])

  useEffect(() => {
    if (taskId && index && index.tasksById) {
      const t = index.tasksById?.[taskId]
      setTask(t || null)
    }
  }, [taskId, index])

  const handleEditTask = () => {
    if (!task) return
    openModal({ type: 'task-edit', taskId: task.id })
  }
  const handleAddFeature = () => {
    if (!task) return
    openModal({ type: 'feature-create', taskId: task.id })
  }
  const handleEditFeature = (featureId: string) => {
    if (!task) return
    openModal({ type: 'feature-edit', taskId: task.id, featureId })
  }

  const handleMoveFeature = async (fromId: string, toIndex: number) => {
    if (!task) return
    setSaving(true)
    try {
      const res = await window.tasksIndex.reorderFeatures(task.id, { fromId, toIndex })
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder feature: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  if (!task) return <div className="empty">Task {taskId} not found. <button onClick={() => { navigateView('Home') }}>Back to Tasks</button></div>

  const features = task.features || []

  return (
    <section id="task-details-view" role="region" aria-labelledby="task-details-heading">
      <h2 id="task-details-heading">Task {task.id}</h2>
      <div className="task-details-controls">
        <button type="button" className="btn-back" onClick={() => { navigateView('Home') }}>Back to Tasks</button>
      </div>

      <div className="task-meta">
        <div className="task-title">
          <h3>{task.title || ''}</h3>
          <StatusBadge status={task.status} />
          <span className="spacer" />
          <button type="button" className="btn-edit-task" onClick={handleEditTask}>Edit Task</button>
        </div>
        <div className="task-id"><strong>ID: </strong>{String(task.id)}</div>
        <div className="task-desc">{task.description || ''}</div>
      </div>

      <h3>Features</h3>
      <div className="features-container">
        <div className="feature-create-controls">
          <button type="button" className="btn-add-feature" onClick={handleAddFeature}>Add Feature</button>
        </div>
        {features.length === 0 ? (
          <div className="empty">No features defined for this task.</div>
        ) : (
          <ul className="features-list" role="list" aria-label="Features">
            {features.map((f: Feature, index: number) => (
              <li key={f.id} className="feature-item" role="listitem">
                <div className="feature-row" role="group" aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}`}>
                  <div className="col col-id">{f.id || ''}</div>
                  <div className="col col-title">{f.title || ''}</div>
                  <div className="col col-status"><StatusBadge status={f.status} /></div>
                  <div className="col col-actions">
                    <button type="button" className="btn-edit" onClick={() => handleEditFeature(f.id)}>Edit</button>
                    <button type="button" className="btn-move-up" disabled={index === 0 || saving} onClick={() => handleMoveFeature(f.id, index - 1)}>Up</button>
                    <button type="button" className="btn-move-down" disabled={index === features.length - 1 || saving} onClick={() => handleMoveFeature(f.id, index + 1)}>Down</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
