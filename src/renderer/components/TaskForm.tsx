import React, { useState } from 'react'
import type { Status, Task } from 'src/types/tasks'

const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done', '~': 'In Progress', '-': 'Pending', '?': 'Blocked', '=': 'Deferred'
}

export type TaskFormValues = Pick<Task, 'id' | 'status' | 'title' | 'description'>

type TaskFormProps = {
  initialValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormValues) => void
  onCancel: () => void
  submitting: boolean
  isCreate: boolean
}

export function TaskForm({ initialValues = {}, onSubmit, onCancel, submitting, isCreate }: TaskFormProps) {
  const [id, setId] = useState<number | ''>(initialValues.id ?? (isCreate ? '' : ''))
  const [status, setStatus] = useState<Status>(initialValues.status ?? '-')
  const [title, setTitle] = useState(initialValues.title ?? '')
  const [description, setDescription] = useState(initialValues.description ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const idVal = typeof id === 'number' ? id : parseInt(String(id || ''), 10)
    onSubmit({ id: isCreate ? idVal : (initialValues.id as number), status, title, description })
  }

  return (
    <form onSubmit={handleSubmit} className="task-form">
      {isCreate && (
        <div className="form-row">
          <label htmlFor="task-id">ID</label>
          <input id="task-id" type="number" min={1} step={1} value={id} onChange={(e) => setId(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
        </div>
      )}
      {!isCreate && <div className="form-row"><label>ID</label><p>{initialValues.id}</p></div>}
      <div className="form-row">
        <label htmlFor="task-status">Status</label>
        <select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {(['+', '~', '-', '?', '='] as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="task-title">Title</label>
        <input id="task-title" type="text" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="task-desc">Description</label>
        <textarea id="task-desc" rows={4} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn" disabled={submitting}>{isCreate ? 'Create' : 'Save'}</button>
      </div>
    </form>
  )
}
