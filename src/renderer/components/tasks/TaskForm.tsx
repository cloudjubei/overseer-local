import React, { useMemo, useState } from 'react'
import type { Task } from '../../../../packages/factory-ts/src/types'
import { StatusControl } from './StatusControl'

export function TaskForm({ initial, onSubmit, submitLabel = 'Save' }: { initial: Partial<Task>; onSubmit: (t: Partial<Task>) => void; submitLabel?: string }) {
  const [title, setTitle] = useState(initial.title || '')
  const [description, setDescription] = useState(initial.description || '')
  const [status, setStatus] = useState(initial.status || '-')

  const isValid = useMemo(() => title.trim().length > 0 && description.trim().length > 0, [title, description])

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ title, description, status }) }}
      className="flex flex-col gap-2"
    >
      <label className="text-sm">Title</label>
      <input className="input input-bordered" value={title} onChange={e => setTitle(e.target.value)} />

      <label className="text-sm">Description</label>
      <textarea className="textarea textarea-bordered min-h-[120px]" value={description} onChange={e => setDescription(e.target.value)} />

      <label className="text-sm">Status</label>
      <StatusControl value={status as any} onChange={setStatus as any} />

      <div className="pt-2">
        <button className="btn btn-primary" disabled={!isValid} type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
