import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigator } from '../navigation/Navigator'
import DependencyBullet from '../components/tasks/DependencyBullet'
import { useActiveProject } from '../projects/ProjectContext'
import StatusControl from '../components/tasks/StatusControl'
import { STATUS_LABELS } from '../services/tasksService';
import { useTasks } from '../hooks/useTasks'
import { Button } from '../components/ui/Button'
import { useAgents } from '../hooks/useAgents'
import AgentRunBullet from '../components/agents/AgentRunBullet'
import { AgentType, Feature, Status, Task } from 'packages/factory-ts/src/types'
import { IconBack, IconChevron, IconExclamation, IconPlay, IconPlus } from '../components/ui/Icons'
import ExclamationChip from '../components/tasks/ExclamationChip'
import RunAgentButton from '../components/tasks/RunAgentButton'
import { RichText } from '../components/ui/RichText'

export default function TaskDetailsView({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)
  const { openModal, navigateView, tasksRoute, navigateAgentRun } = useNavigator()
  const ulRef = useRef<HTMLUListElement>(null)
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(true)

  const [dragFeatureId, setDragFeatureId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null)
  const { project, projectId } = useActiveProject()
  const { tasksById, updateTask, updateFeature, reorderFeatures, getBlockers, getBlockersOutbound } = useTasks()
  const { activeRuns, startTaskAgent, startFeatureAgent, cancelRun } = useAgents()

  // Tracks if the initial pointer down started within a .no-drag element to block parent row dragging
  const preventDragFromNoDragRef = useRef(false)

  useEffect(() => {
    if (taskId && tasksById) {
      const t = tasksById[taskId]
      setTask(t)
    } else {
      setTask(null)
    }
  }, [taskId, tasksById])

  const sortedFeatures = useMemo(() => {
    if (!task) { return []}
    return task.features.sort((a,b) => task.featureIdToDisplayIndex[a.id] - task.featureIdToDisplayIndex[b.id])
  }, [task, tasksById])

  const handleEditTask = () => { if (!task) return; openModal({ type: 'task-edit', taskId: task.id }) }
  const handleAddFeature = () => { if (!task) return; openModal({ type: 'feature-create', taskId: task.id }) }
  const handleEditFeature = (featureId: string) => { if (!task) return; openModal({ type: 'feature-edit', taskId: task.id, featureId }) }

  const handleTaskStatusChange = async (taskId: string, status: Status) => {
    try {
      await updateTask(taskId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }
  const handleFeatureStatusChange = async (taskId: string, featureId: string, status: Status) => {
    try {
      await updateFeature(taskId, featureId, { status })
    } catch (e) {
      console.error('Failed to update status', e)
    }
  }

  const handleMoveFeature = async (fromIndex: number, toIndex: number) => {
    if (!task) return
    setSaving(true)
    try {
      const res = await reorderFeatures(task.id, fromIndex, toIndex)
      if (!res || !res.ok) throw new Error(res?.error || 'Unknown error')
    } catch (e: any) {
      alert(`Failed to reorder feature: ${e.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const computeDropForRow = (e: React.DragEvent<HTMLElement>, idx: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    let pos: 'before' | 'after' | null = offsetY < rect.height / 2 ? 'before' : 'after'
    if (draggingIndex != null && (idx == draggingIndex || (idx == draggingIndex-1 && pos == 'after') || (idx == draggingIndex+1 && pos == 'before'))){
      pos = null
    }
    setDropIndex(idx)
    setDropPosition(pos)
  }

  const clearDndState = () => {
    setDragFeatureId(null)
    setDragging(false)
    setDraggingIndex(null)
    setDropIndex(null)
    setDropPosition(null)
  }

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, featureId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditFeature(featureId)
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const ul = ulRef.current
    if (!ul) return
    const rows = Array.from(ul.querySelectorAll('.feature-row'))
    const current = e.currentTarget
    const i = rows.indexOf(current)
    if (i === -1) return
    let nextIndex = i + (e.key === 'ArrowDown' ? 1 : -1)
    if (nextIndex < 0) nextIndex = 0
    if (nextIndex >= rows.length) nextIndex = rows.length - 1
    ;(rows[nextIndex] as HTMLElement).focus()
  }

  const highlightFeatureId = tasksRoute.name === 'details' && tasksRoute.taskId === taskId ? tasksRoute.highlightFeatureId : undefined
  const highlightTaskFlag = tasksRoute.name === 'details' && tasksRoute.taskId === taskId ? tasksRoute.highlightTask : undefined

  useEffect(() => {
    if (highlightFeatureId) {
      const row = document.querySelector(`.feature-row[data-feature-id="${highlightFeatureId}"]`)
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        (row as HTMLElement).classList.add('highlighted')
        setTimeout(() => (row as HTMLElement).classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightFeatureId])

  useEffect(() => {
    if (highlightTaskFlag) {
      const element = document.querySelector('.details-header')
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' });
        ;(element as HTMLElement).classList.add('highlighted')
        setTimeout(() => (element as HTMLElement).classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightTaskFlag])

  if (!task) {
    return (
      <div className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <header className="details-header shrink-0">
          <div className="details-header__bar">
            <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }}>
              <IconBack />
              <span className="sr-only">Back to Tasks</span>
            </button>
            <h1 className="details-title">Task {taskId}</h1>
          </div>
        </header>
        <main className="details-content flex-1 min-h-0 overflow-auto p-4">
          <div className="empty">Task {taskId} not found.</div>
        </main>
      </div>
    )
  }

  const dndEnabled = !saving

  const onListDrop = () => {
    if (dragFeatureId != null && draggingIndex != null && dropIndex != null && dropPosition != null) {
      const toIndex = dropIndex + (dropPosition === 'after' ? 1 : 0)
      handleMoveFeature(draggingIndex, toIndex)
    }
    clearDndState()
  }

  const taskBlockers = getBlockers(task.id)
  const taskBlockersOutbound = getBlockersOutbound(task.id)

  const taskRun = activeRuns.find(r => r.taskId === task.id && !r.featureId)
  const taskHasActiveRun = !!taskRun
  const hasRejectedFeatures = task.features.filter(f => !!f.rejection).length > 0
  const taskDisplayIndex = project?.taskIdToDisplayIndex[task.id] ?? 0

  return (
    <div  className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden" role="region" aria-labelledby="task-details-heading">
      <header className="details-header shrink-0">
        <div className="details-header__bar">
          <button type="button" className="btn-secondary" onClick={() => { navigateView('Home') }} aria-label="Back to Tasks">
            <IconBack />
          </button>

          <div className="col col-id flex flex-col items-center gap-1" style={{ gridRow: '1 / 4', alignSelf: 'center' }}>
            {hasRejectedFeatures && <ExclamationChip title={'One or more features were rejected'} tooltip={"Has rejection reason"} />}
            <span className="id-chip">{taskDisplayIndex}</span>
            <StatusControl
              status={task.status}
              className="ml-2"
              onChange={(next) => handleTaskStatusChange(task.id, next)}
            />
          </div>
          
          <h1 id="task-details-heading" className="details-title"><RichText text={task.title || `Task ${taskDisplayIndex}`} /></h1>
          
          <div className="flex flex-col gap-2 ml-2" aria-label={`Blockers for Task ${taskDisplayIndex}`}>
            <div className="chips-list">
              <span className="chips-sub__label">Blockers</span>
              {taskBlockers.length === 0 ? (
                <span className="chips-sub__label" title="No dependencies">None</span>
              ) : (
                taskBlockers.map((d) => (
                  <DependencyBullet key={d.id} dependency={d.id} />
                ))
              )}
            </div>
            <div className="chips-list">
              <span className="chips-sub__label">Blocks</span>
              {taskBlockersOutbound.length === 0 ? (
                <span className="chips-sub__label" title="No dependents">None</span>
              ) : (
                taskBlockersOutbound.map((d) => (
                  <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                ))
              )}
            </div>
          </div>
          <div className="spacer" />
          <div className="flex items-center gap-3">
            {taskRun && (
              <div className="flex items-center gap-2" aria-label={`Active agents for Task ${task.id}`}>
                <AgentRunBullet key={taskRun.runId} run={taskRun} onClick={() => navigateAgentRun(taskRun.runId)} />
              </div>
            )}
            {!taskHasActiveRun && <RunAgentButton onClick={(agentType) => {if (!projectId || taskHasActiveRun) return; startTaskAgent(agentType, projectId, task.id) }}/>
          </div>
        </div>
      </header>

      <main className="details-content flex flex-col flex-1 min-h-0 overflow-hidden">
        <section className="panel shrink-0">
          <div className="section-header">
            <button
              type="button"
              className="collapse-toggle btn-icon"
              aria-expanded={isOverviewExpanded}
              aria-controls="overview-content"
              onClick={() => setIsOverviewExpanded((prev) => !prev)}
            >
              <IconChevron className={`icon-chevron ${isOverviewExpanded ? 'expanded' : ''}`} />
            </button>
            <h2 className="section-title">Overview</h2>
            <div className="section-actions">
              {/* Edit Task button intentionally removed to keep UI consistent with click-to-open behavior elsewhere */}
            </div>
          </div>
          <div id="overview-content" className={`overview-content ${isOverviewExpanded ? 'expanded' : 'collapsed'}`}>
            <p className="task-desc"><RichText text={task.description || 'No description provided.'} /></p>
          </div>
        </section>

        <section className="panel flex flex-col flex-1 min-h-0">
          <div className="section-header shrink-0">
            <h2 className="section-title">Features</h2>
            <div className="section-actions">
              <button type="button" className="btn btn-icon" aria-label="Add feature" onClick={handleAddFeature}>
                <IconPlus />
              </button>
            </div>
          </div>

          {sortedFeatures.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto empty">No features defined for this task.</div>
          ) : (
            <ul
              className={`flex-1 min-h-0 overflow-y-auto features-list ${dragging ? 'dnd-active' : ''}`}
              role="list"
              aria-label="Features"
              ref={ulRef}
              onDragOver={(e) => { if (dndEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }}
              onDrop={(e) =>{
                if (!dndEnabled || !dragging) return
                e.preventDefault()
                preventDragFromNoDragRef.current = false
                onListDrop()
              }}
              onDragEnd={() => { preventDragFromNoDragRef.current = false; clearDndState() }}
            >
              {sortedFeatures.map((f: Feature, idx: number) => {
                const blockers = getBlockers(task.id, f.id)
                const blockersOutbound = getBlockersOutbound(f.id)

                const isDragSource = dragFeatureId === f.id
                const isDropBefore = dragging && dropIndex === idx && dropPosition === 'before'
                const isDropAfter = dragging && dropIndex === idx && dropPosition === 'after'

                const featureRun = activeRuns.find(r => r.taskId === task.id && r.featureId === f.id)
                const featureHasActiveRun = !!featureRun

                return (
                  <li key={f.id} className="feature-item" role="listitem">
                    {isDropBefore && <div className="drop-indicator" aria-hidden="true"></div>}
                    <div
                      className={`feature-row ${dndEnabled ? 'draggable' : ''} ${isDragSource ? 'is-dragging' : ''} ${dragging && dropIndex === idx ? 'is-drop-target' : ''} ${f.id === highlightFeatureId ? 'highlighted' : ''}`}
                      role="button"
                      tabIndex={0}
                      data-index={idx}
                      data-feature-id={f.id}
                      draggable={dndEnabled}
                      aria-grabbed={isDragSource}
                      onPointerDownCapture={(e) => {
                        const t = e.target as HTMLElement | null
                        preventDragFromNoDragRef.current = !!(t && t.closest('.no-drag'))
                      }}
                      onPointerUpCapture={() => { preventDragFromNoDragRef.current = false }}
                      onDragStart={(e) => {
                        // If the initial pointer down started on a non-draggable UI (e.g., action buttons), block row drag
                        if (preventDragFromNoDragRef.current) {
                          e.preventDefault()
                          e.stopPropagation()
                          preventDragFromNoDragRef.current = false
                          return
                        }
                        if (!dndEnabled) return
                        // Fallback: if somehow target is within .no-drag, block as well
                        const target = e.target as HTMLElement | null
                        if (target && target.closest('.no-drag')) {
                          e.preventDefault()
                          e.stopPropagation()
                          return
                        }
                        setDragFeatureId(f.id)
                        setDragging(true)
                        setDraggingIndex(idx)
                        e.dataTransfer.setData('text/plain', String(f.id))
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onDragOver={(e) => { if (!dndEnabled) return; e.preventDefault(); computeDropForRow(e, idx) }}
                      onKeyDown={(e) => onRowKeyDown(e, f.id)}
                      onClick={(e) => {
                        // Ignore clicks if we were dragging or if clicking on specific action areas
                        if (dragging) return
                        const t = e.target as HTMLElement | null
                        if (t && t.closest('.no-drag')) return
                        handleEditFeature(f.id)
                      }}
                      aria-label={`Feature ${f.id}: ${f.title}. Status ${STATUS_LABELS[f.status as Status] || f.status}. ${blockers.length} items this feature is blocked by, ${blockersOutbound.length} items this feature is blocking.  Press Enter to edit.`}
                    >
                      <div className="col col-id">
                        <span className="id-chip">{task.featureIdToDisplayIndex[f.id]}</span>
                        <StatusControl
                          status={f.status}
                          onChange={(next) => handleFeatureStatusChange(task.id, f.id, next)}
                        />
                        {f.rejection && <ExclamationChip title={f.rejection} tooltip={"Has rejection reason"} />}
                      </div>

                      <div className="col col-title" >
                        <span className="title-text"><RichText text={f.title || ''} /></span>
                      </div>
                      <div className="col col-description"  title={f.description || ''}>
                        <RichText text={f.description || ''} />
                      </div>
                      <div className="col col-actions">
                        {/* Edit button removed: clicking the row will open edit */}
                        {!featureHasActiveRun && <RunAgentButton onClick={(agentType) => {if (!projectId || featureHasActiveRun) return; startFeatureAgent(agentType, projectId, task.id, f.id) }}/>
                      </div>

                      <div style={{ gridRow: 3, gridColumn: 2 }} className="flex items-center justify-between gap-8" aria-label={`Blockers and actions for Feature ${f.id}`}>
                        <div className="flex gap-8">
                          <div className="chips-list">
                            <span className="chips-sub__label">References</span>
                            {blockers.length === 0 ? (
                              <span className="chips-sub__label" title="No dependencies">None</span>
                            ) : (
                              blockers.map((d) => (
                                <DependencyBullet key={d.id} dependency={d.id} />
                              ))
                            )}
                          </div>
                          <div className="chips-list">
                            <span className="chips-sub__label">Blocks</span>
                            {blockersOutbound.length === 0 ? (
                              <span className="chips-sub__label" title="No dependents">None</span>
                            ) : (
                              blockersOutbound.map((d) => (
                                <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                              ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pr-2">
                          {featureRun && (
                            <div className="flex items-center gap-2" aria-label={`Active agents for Feature ${f.id}`}>
                              <AgentRunBullet key={featureRun.runId} run={featureRun} onClick={(e) => { e.stopPropagation(); navigateAgentRun(featureRun.runId) }} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {isDropAfter && <div className="drop-indicator" aria-hidden="true"></div>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>

      {saving && <div className="saving-indicator" aria-live="polite" style={{ position: 'fixed', bottom: 12, right: 16 }}>Reordering…</div>}
    </div>
  )
}
