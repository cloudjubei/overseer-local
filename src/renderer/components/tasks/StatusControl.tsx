import React from 'react'
import type { Status } from '../../../../packages/factory-ts/src/types'

export function StatusControl({ value, onChange }: { value: Status; onChange: (v: Status) => void }) {
  return (
    <select className="select select-bordered select-sm" value={value} onChange={e => onChange(e.target.value as Status)}>
      <option value="-">Pending</option>
      <option value="~">In Progress</option>
      <option value="+">Done</option>
      <option value="?">Blocked</option>
      <option value="=">Deferred</option>
    </select>
  )
}
