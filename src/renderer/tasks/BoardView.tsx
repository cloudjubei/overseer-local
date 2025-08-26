import React, { useMemo, useRef, useState } from 'react'
import type { Task, Status } from 'src/types/tasks'
import StatusBadge from '../components/tasks/StatusBadge'
import TaskCard from '../components/tasks/TaskCard'
import { tasksService } from '../services/tasksService'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']
const STATUS_LABELS: Record<Status, string> = {
  '+': 'Done',
  '~': 'In Progress',
  '-': 'Pending',
  '?': 'Blocked',
  '=': 'Deferred',
}

type Props = {
  tasks: Task[]
}

export default function BoardView({ tasks }: Props) {
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<Status | null>(null)
  const colRefs = useRef<Record<Status, HTMLDivElement | null>>({ '+': null, '~': null, '-': null, '?': null, '=': null })

  const grouped = useMemo(() => {
    const map: Record<Status, Task[]> = { '+': [], '~': [], '-': [], '?': [], '=': [] }
    for (const t of tasks) { map[t.status].push(t) }
    for (const k of Object.keys(map) as Status[]) {
      map[k].sort((a, b) => (a.id || 0) - (b.id || 0))
    }
    return map
  }, [tasks])

  const totals = useMemo(() => {
    const res: Record<Status, number> = { '+': 0, '~': 0, '-': 0, '?': 0, '=': 0 }
    for (const s of STATUS_ORDER) res[s] = grouped[s].length
    return res
  }, [grouped])

  const onDragStart = (e: React.DragEvent, taskId: number) => {
    setDragId(taskId)
    e.dataTransfer.setData('text/plain', String(taskId))
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragOverCol = (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(status)
  }

  const onDropCol = async (e: React.DragEvent, status: Status) => {
    e.preventDefault()
    const idStr = e.dataTransfer.getData('text/plain')
    const fromId = idStr ? parseInt(idStr, 10) : dragId
    setDragOver(null)
    setDragId(null)
    if (!fromId) return
    // Update task status when moved between columns
    const task = tasks.find(t => t.id === fromId)
    if (!task || task.status === status) return
    try {
      await tasksService.updateTask(fromId, { status })
    } catch (err) {
      console.error('Failed to move task', err)
      alert('Failed to move task')
    }
  }

  return (
    <div className="board" role="region" aria-label="Board view">
      {STATUS_ORDER.map((s) => (
        <div
          key={s}
          ref={(el) => { colRefs.current[s] = el }}
          className={`board-col ${dragOver === s ? 'drag-over' : ''} ${
            s === '+' ? 'board-col--status-done' : s === '~' ? 'board-col--status-inprogress' : s === '-' ? 'board-col--status-pending' : s === '?' ? 'board-col--status-blocked' : 'board-col--status-deferred'
          }`}
          onDragOver={(e) => onDragOverCol(e, s)}
          onDrop={(e) => onDropCol(e, s)}
          aria-label={`${STATUS_LABELS[s]} column`}
        >
          <div className={`board-col__header ${
            s === '+' ? 'header-done' : s === '~' ? 'header-inprogress' : s === '-' ? 'header-pending' : s === '?' ? 'header-blocked' : 'header-deferred'
          }`}>
            <div className="board-col__title">
              <StatusBadge status={s} /> {STATUS_LABELS[s]}
            </div>
            <div className="board-col__count">{totals[s]}</div>
          </div>
          <div className="board-col__body">
            {grouped[s].length === 0 ? (
              <div className="empty">No tasks</div>
            ) : (
              grouped[s].map((t) => (
                <div key={t.id} draggable className="task-card" onDragStart={(e) => onDragStart(e, t.id)} aria-label={`Drag task ${t.id}`}>
                  <TaskCard task={t} />
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
