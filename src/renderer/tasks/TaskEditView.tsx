import React from 'react'
import type { Task } from '../../../packages/factory-ts/src/types'
import { TaskForm } from '../components/tasks/TaskForm'

export function TaskEditView({ task, onSave }: { task: Task; onSave: (data: Partial<Task>) => void }) {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Edit Task [{task.id}]</h2>
      <TaskForm initial={task} onSubmit={onSave} />
    </div>
  )
}
