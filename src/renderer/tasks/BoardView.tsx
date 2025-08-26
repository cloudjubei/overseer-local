import React, { useMemo, useState } from 'react'
import type { Task, Status } from 'src/types/tasks'
import TaskCard from '../components/tasks/TaskCard'
import { tasksService } from '../services/tasksService'
import { useNavigator } from '../navigation/Navigator'

const STATUS_ORDER: Status[] = ['+', '~', '-', '?', '=']
const STATUS_TITLES: Record<Status, string> = { '+': 'Done', '~': 'In Progress', '-': 'Pending', '?': 'Blocked', '=': 'Deferred' }

function Column({ status, tasks, onDropTask, onCardClick }: {
  status: Status
  tasks: Task[]
  onDropTask: (taskId: number, targetStatus: Status) => void
  onCardClick: (taskId: number) => void
}) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isOver) setIsOver(true) }
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); if (!isOver) setIsOver(true) }
  const handleDragLeave = () => { setIsOver(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false)
    const idStr = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain')
    const taskId = parseInt(idStr, 10)
    if (!Number.isNaN(taskId)) onDropTask(taskId, status)
  }
  return (
    <div className={`board-col ${isOver ? 'drag-over' : ''} board-col--status-${status}`} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDrop={handleDrop} aria-label={`${STATUS_TITLES[status]} column`}>
      <div className={`board-col__header header-${status}`}>
        <span className="board-col__title">{STATUS_TITLES[status]}</span>
        <span className="board-col__count">{tasks.length}</span>
      </div>
      <div className="board-col__body">
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onClick={() => onCardClick(t.id)} draggable onDragStart={(e) => { e.dataTransfer.setData('text/task-id', String(t.id)); e.dataTransfer.effectAllowed = 'move' }} />
        ))}
      </div>
    </div>
  )
}

export default function BoardView({ tasks }: { tasks: Task[] }) {
  const groups = useMemo(() => {
    const g: Record<Status, Task[]> = { '+': [], '~': [], '-': [], '?': [], '=': [] }
    for (const t of tasks) { (g[t.status] ||= []).push(t) }
    return g
  }, [tasks])
  const { navigateTaskDetails } = useNavigator()

  const onDropTask = async (taskId: number, targetStatus: Status) => {
    try {
      await tasksService.updateTask(taskId, { status: targetStatus })
    } catch (e) {
      console.error('Failed to update status via board drop', e)
    }
  }

  return (
    <div className="board" role="grid" aria-label="Tasks Board">
      {STATUS_ORDER.map(s => (
        <Column key={s} status={s} tasks={groups[s]} onDropTask={onDropTask} onCardClick={navigateTaskDetails} />
      ))}
    </div>
  )
}
