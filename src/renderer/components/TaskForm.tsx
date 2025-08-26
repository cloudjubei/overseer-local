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
  titleRef?: React.RefObject<HTMLInputElement>
}

export function TaskForm({ initialValues = {}, onSubmit, onCancel, submitting, isCreate, titleRef }: TaskFormProps) {
  const [id, setId] = useState<number | ''>(initialValues.id ?? (isCreate ? '' : ''))
  const [status, setStatus] = useState<Status>(initialValues.status ?? '-')
  const [title, setTitle] = useState(initialValues.title ?? '')
  const [description, setDescription] = useState(initialValues.description ?? '')

  const doSubmit = () => {
    const idVal = typeof id === 'number' ? id : parseInt(String(id || ''), 10)
    onSubmit({ id: isCreate ? idVal : (initialValues.id as number), status, title, description })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSubmit()
  }

  const onKeyDown: React.KeyboardEventHandler<HTMLFormElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
      e.preventDefault()
      doSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={onKeyDown} className="task-form">
      {isCreate && (
        <div className="form-row">
          <label htmlFor="task-id">ID</label>
          <input
            id="task-id"
            className="ui-input"
            type="number"
            min={1}
            step={1}
            value={id}
            onChange={(e) => setId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
          />
        </div>
      )}
      {!isCreate && <div className="form-row"><label>ID</label><p>{initialValues.id}</p></div>}
      <div className="form-row">
        <label htmlFor="task-status">Status</label>
        <select id="task-status" className="ui-select" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {(['+', '~', '-', '?', '='] as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]} ({s})</option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          ref={titleRef}
          className="ui-input"
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="task-desc">Description</label>
        <textarea
          id="task-desc"
          className="ui-textarea"
          rows={4}
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn" disabled={submitting}>{isCreate ? 'Create' : 'Save'}</button>
      </div>
    </form>
  )
}
