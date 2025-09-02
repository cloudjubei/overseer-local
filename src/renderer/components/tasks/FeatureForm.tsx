import React, { useMemo, useState } from 'react'
import type { Feature } from '../../../../packages/factory-ts/src/types'
import { StatusControl } from './StatusControl'

export function FeatureForm({ initial, onSubmit, submitLabel = 'Save' }: { initial: Partial<Feature>; onSubmit: (f: Partial<Feature>) => void; submitLabel?: string }) {
  const [title, setTitle] = useState(initial.title || '')
  const [description, setDescription] = useState(initial.description || '')
  const [plan, setPlan] = useState(initial.plan || '')
  const [status, setStatus] = useState(initial.status || '-')

  const isValid = useMemo(() => title.trim().length > 0 && description.trim().length > 0, [title, description])

  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit({ title, description, plan, status }) }}
      className="flex flex-col gap-2"
    >
      <label className="text-sm">Title</label>
      <input className="input input-bordered" value={title} onChange={e => setTitle(e.target.value)} />

      <label className="text-sm">Description</label>
      <textarea className="textarea textarea-bordered min-h-[120px]" value={description} onChange={e => setDescription(e.target.value)} />

      <label className="text-sm">Plan</label>
      <textarea className="textarea textarea-bordered min-h-[120px]" value={plan} onChange={e => setPlan(e.target.value)} />

      <label className="text-sm">Status</label>
      <StatusControl value={status as any} onChange={setStatus as any} />

      <div className="pt-2">
        <button className="btn btn-primary" disabled={!isValid} type="submit">{submitLabel}</button>
      </div>
    </form>
  )
}
