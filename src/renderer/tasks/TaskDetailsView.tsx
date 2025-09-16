import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigator } from '../navigation/Navigator'
import DependencyBullet from '../components/tasks/DependencyBullet'
import StatusControl from '../components/tasks/StatusControl'
import { STATUS_LABELS } from '../services/tasksService'
import { useActiveProject } from '../contexts/ProjectContext'
import { useTasks } from '../contexts/TasksContext'
import { useAgents } from '../contexts/AgentsContext'
import AgentRunBullet from '../components/agents/AgentRunBullet'
import { Feature, Status, Task } from 'thefactory-tools'
import { IconBack, IconChevron, IconEdit, IconPlus } from '../components/ui/Icons'
import ExclamationChip from '../components/tasks/ExclamationChip'
import RunAgentButton from '../components/tasks/RunAgentButton'
import { RichText } from '../components/ui/RichText'
import ModelChip from '../components/agents/ModelChip'
import { StatusPicker, statusKey } from '../components/tasks/StatusControl'
import { gitMonitorService } from '../services/gitMonitorService'
import { Button } from '../components/ui/Button'

const STATUS_ORDER: Status[] = ['-', '~', '+', '=', '?']

type FeatureSort = 'index_asc' | 'index_desc' | 'status_asc' | 'status_desc'

function featureMatchesQuery(f: Feature, q: string) {
  if (!q) return true
  const s = q.trim().toLowerCase()
  if (!s) return true
  const idStr = String(f.id || '')
  return (
    idStr.includes(s) ||
    (f.title || '').toLowerCase().includes(s) ||
    (f.description || '').toLowerCase().includes(s)
  )
}

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
  const {
    tasksById,
    updateTask,
    updateFeature,
    reorderFeatures,
    getBlockers,
    getBlockersOutbound,
  } = useTasks()
  const { runsHistory, startTaskAgent, startFeatureAgent } = useAgents()

  // Tracks if the initial pointer down started within a .no-drag element to block parent row dragging
  const preventDragFromNoDragRef = useRef(false)

  // Local search/sort/filter state (not persisted)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'not-done' | Status>('not-done')
  const [sortBy, setSortBy] = useState<FeatureSort>('index_asc')
  const [openFilter, setOpenFilter] = useState(false)
  const statusFilterRef = useRef<HTMLDivElement>(null)

  // Git merge UI state
  const [gitBaseBranch, setGitBaseBranch] = useState<string | null>(null)
  const [hasUnmerged, setHasUnmerged] = useState<boolean>(false)
  const [checkingMerge, setCheckingMerge] = useState<boolean>(false)
  const [merging, setMerging] = useState<boolean>(false)
  const [mergeError, setMergeError] = useState<string | null>(null)

  useEffect(() => {
    if (taskId && tasksById) {
      const t = tasksById[taskId]
      setTask(t)
    } else {
      setTask(null)
    }
  }, [taskId, tasksById])

  //TODO: logic needs to be cleand up
  // useEffect(() => {
  //   let disposed = false

  //   async function check() {
  //     if (!task) {
  //       setHasUnmerged(false)
  //       return
  //     }
  //     setCheckingMerge(true)
  //     try {
  //       const status = await gitMonitorService.getStatus()
  //       const base = status.currentBranch || null
  //       setGitBaseBranch(base)
  //       const branchName = `features/${task.id}`
  //       if (!base) {
  //         setHasUnmerged(false)
  //         return
  //       }
  //       const res = await gitMonitorService.hasUnmerged(branchName, base)
  //       if (!disposed) {
  //         setHasUnmerged(!!res.ok && !!res.hasUnmerged)
  //       }
  //     } catch (e) {
  //       if (!disposed) setHasUnmerged(false)
  //     } finally {
  //       if (!disposed) setCheckingMerge(false)
  //     }
  //   }

  //   check()
  //   const unsubscribe = gitMonitorService.subscribe((_s) => {
  //     // Re-check on git status updates
  //     check()
  //   })
  //   return () => {
  //     disposed = true
  //     unsubscribe?.()
  //   }
  // }, [task])

  const sortedFeaturesBase = useMemo(() => {
    if (!task) {
      return []
    }
    return [...task.features].sort(
      (a, b) => task.featureIdToDisplayIndex[a.id] - task.featureIdToDisplayIndex[b.id],
    )
  }, [task, tasksById])

  const featuresSorted = useMemo(() => {
    let arr = [...sortedFeaturesBase]
    if (sortBy === 'index_asc') {
      // already asc
      return arr
    } else if (sortBy === 'index_desc') {
      return arr.slice().reverse()
    } else if (sortBy === 'status_asc') {
      const sVal = (f: Feature) => STATUS_ORDER.indexOf(f.status)
      return arr.sort(
        (a, b) =>
          sVal(a) - sVal(b) ||
          (task ? task.featureIdToDisplayIndex[a.id] - task.featureIdToDisplayIndex[b.id] : 0),
      )
    } else if (sortBy === 'status_desc') {
      const sVal = (f: Feature) => STATUS_ORDER.indexOf(f.status)
      return arr.sort(
        (a, b) =>
          sVal(b) - sVal(a) ||
          (task ? task.featureIdToDisplayIndex[b.id] - task.featureIdToDisplayIndex[a.id] : 0),
      )
    }
    return arr
  }, [sortedFeaturesBase, sortBy, task])

  const featuresFiltered = useMemo(() => {
    return featuresSorted.filter((f) => {
      const byStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'not-done'
            ? f.status !== '+' || f.rejection
            : f.status === statusFilter
      return byStatus && featureMatchesQuery(f, query)
    })
  }, [featuresSorted, statusFilter, query])

  const isSearchFiltered = query !== ''

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

  // Allow DnD for index sorting when only the special 'not-done' filter is active (no search)
  const dndEnabled =
    (sortBy === 'index_asc' || sortBy === 'index_desc') && !isSearchFiltered && !saving

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
    if (
      draggingIndex != null &&
      (idx == draggingIndex ||
        (idx == draggingIndex - 1 && pos == 'after') ||
        (idx == draggingIndex + 1 && pos == 'before'))
    ) {
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

  const highlightFeatureId =
    tasksRoute.name === 'details' && tasksRoute.taskId === taskId
      ? tasksRoute.highlightFeatureId
      : undefined
  const highlightTaskFlag =
    tasksRoute.name === 'details' && tasksRoute.taskId === taskId
      ? tasksRoute.highlightTask
      : undefined

  useEffect(() => {
    if (highlightFeatureId) {
      const row = document.querySelector(`.feature-row[data-feature-id="${highlightFeatureId}"]`)
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' })
        ;(row as HTMLElement).classList.add('highlighted')
        setTimeout(() => (row as HTMLElement).classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightFeatureId])

  useEffect(() => {
    if (highlightTaskFlag) {
      const element = document.querySelector('.details-header')
      if (element) {
        element.scrollIntoView({ block: 'start', behavior: 'smooth' })
        ;(element as HTMLElement).classList.add('highlighted')
        setTimeout(() => (element as HTMLElement).classList.remove('highlighted'), 2000)
      }
    }
  }, [highlightTaskFlag])

  const onClickMerge = async () => {
    if (!task) return
    setMergeError(null)
    setMerging(true)
    try {
      const status = await gitMonitorService.getStatus()
      const base = status.currentBranch
      const branchName = `features/${task.id}`
      if (!base) throw new Error('No base branch detected')
      const res = await gitMonitorService.mergeBranch(branchName, base)
      if (!res.ok) throw new Error(res.error || 'Merge failed')
      // Refresh and update button state
      await gitMonitorService.triggerPoll()
      const check = await gitMonitorService.hasUnmerged(branchName, base)
      setHasUnmerged(!!check.ok && !!check.hasUnmerged)
    } catch (e: any) {
      setMergeError(e?.message || String(e))
    } finally {
      setMerging(false)
    }
  }

  if (!task) {
    return (
      <div className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden">
        <header className="details-header shrink-0">
          <div className="details-header__bar">
            <Button
              className="btn-secondary"
              onClick={() => {
                navigateView('Home')
              }}
            >
              <IconBack className="w-4 h-4" />
              <span className="sr-only">Back to Tasks</span>
            </Button>
            <h1 className="details-title">Task {taskId}</h1>
          </div>
        </header>
        <main className="details-content flex-1 min-h-0 overflow-auto p-4">
          <div className="empty">Task {taskId} not found.</div>
        </main>
      </div>
    )
  }

  const onListDrop = () => {
    if (!task) {
      clearDndState()
      return
    }
    if (
      dragFeatureId != null &&
      draggingIndex != null &&
      dropIndex != null &&
      dropPosition != null
    ) {
      // Map from feature id/display index back to absolute indices within the task
      const fromIndex = (task.featureIdToDisplayIndex[dragFeatureId] ?? 1) - 1
      const targetFeature = featuresFiltered[dropIndex]
      if (!targetFeature) {
        clearDndState()
        return
      }
      let toIndex = (task.featureIdToDisplayIndex[targetFeature.id] ?? 1) - 1
      if (dropPosition === 'after') {
        toIndex = toIndex + 1
      }
      handleMoveFeature(fromIndex, toIndex)
    }
    clearDndState()
  }

  const taskBlockers = getBlockers(task.id)
  const taskBlockersOutbound = getBlockersOutbound(task.id)

  const taskRun = runsHistory.find((r) => r.state === 'running' && r.taskId === task.id)
  const taskHasActiveRun = !!taskRun
  const hasRejectedFeatures = task.features.filter((f) => !!f.rejection).length > 0
  const taskDisplayIndex = project?.taskIdToDisplayIndex[task.id] ?? 0

  const currentFilterLabel =
    statusFilter === 'all'
      ? 'All'
      : statusFilter === 'not-done'
        ? 'Not done'
        : `${STATUS_LABELS[statusFilter as Status]}`
  const k =
    statusFilter === 'all'
      ? 'queued'
      : statusFilter === 'not-done'
        ? 'queued'
        : statusKey(statusFilter as Status)

  return (
    <div
      className="task-details flex flex-col flex-1 min-h-0 w-full overflow-hidden"
      role="region"
      aria-labelledby="task-details-heading"
    >
      <header className="details-header shrink-0">
        <div className="details-header__bar">
          <Button
            className="btn-secondary w-9 "
            onClick={() => {
              navigateView('Home')
            }}
            aria-label="Back to Tasks"
          >
            <IconBack className="w-4 h-4" />
          </Button>

          <div
            className="col col-id flex flex-col items-center gap-1"
            style={{ gridRow: '1 / 4', alignSelf: 'center' }}
          >
            {hasRejectedFeatures && (
              <ExclamationChip
                title={'One or more features were rejected'}
                tooltip="Has rejection reason"
              />
            )}
            <span className="id-chip">{taskDisplayIndex}</span>
            <StatusControl
              status={task.status}
              className="ml-2"
              onChange={(next) => handleTaskStatusChange(task.id, next)}
            />
          </div>

          <h1 id="task-details-heading" className="details-title">
            <RichText text={task.title || `Task ${taskDisplayIndex}`} />
          </h1>

          <div
            className="flex flex-col gap-2 ml-2"
            aria-label={`Blockers for Task ${taskDisplayIndex}`}
          >
            <div className="chips-list">
              <span className="chips-sub__label">Blockers</span>
              {taskBlockers.length === 0 ? (
                <span className="chips-sub__label" title="No dependencies">
                  None
                </span>
              ) : (
                taskBlockers.map((d) => <DependencyBullet key={d.id} dependency={d.id} />)
              )}
            </div>
            <div className="chips-list">
              <span className="chips-sub__label">Blocks</span>
              {taskBlockersOutbound.length === 0 ? (
                <span className="chips-sub__label" title="No dependents">
                  None
                </span>
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
              <div
                className="flex items-center gap-2"
                aria-label={`Active agents for Task ${task.id}`}
              >
                <AgentRunBullet
                  key={taskRun.id}
                  run={taskRun}
                  onClick={() => navigateAgentRun(taskRun.id)}
                />
              </div>
            )}
            <ModelChip editable />

            {/* <button
              type="button"
              className={`btn ${!hasUnmerged || merging || checkingMerge ? 'btn-disabled' : ''}`}
              disabled={!hasUnmerged || merging || checkingMerge}
              title={
                mergeError
                  ? `Merge failed: ${mergeError}`
                  : hasUnmerged
                    ? `Merge features/${task.id} into ${gitBaseBranch || 'current branch'}`
                    : checkingMerge
                      ? 'Checking merge status...'
                      : 'No commits to merge'
              }
              onClick={onClickMerge}
            >
              {merging ? 'Merging…' : 'Merge'}
            </button> */}
            {!taskHasActiveRun && (
              <RunAgentButton
                onClick={(agentType) => {
                  if (!projectId || taskHasActiveRun) return
                  startTaskAgent(agentType, projectId, task.id)
                }}
              />
            )}
          </div>
        </div>
      </header>

      {/* Top toolbars similar to TasksListView: search/filter/sort and count/add */}
      <div className="tasks-toolbar shrink-0">
        <div className="left">
          <div className="control search-wrapper">
            <input
              type="search"
              placeholder="Search by id, title, or description"
              aria-label="Search features"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="control">
            <div
              ref={statusFilterRef}
              className="status-filter-btn ui-select gap-2"
              role="button"
              aria-haspopup="menu"
              aria-expanded={openFilter}
              aria-label="Filter by status"
              tabIndex={0}
              onClick={() => setOpenFilter(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setOpenFilter(true)
              }}
            >
              <span className={`status-bullet status-bullet--${k}`} aria-hidden />
              <span className="standard-picker__label">{currentFilterLabel}</span>
            </div>
            {openFilter && statusFilterRef.current && (
              <StatusPicker
                anchorEl={statusFilterRef.current}
                value={statusFilter}
                isAllAllowed={true}
                includeNotDone={true}
                onSelect={(val) => {
                  setStatusFilter(val as any)
                  setOpenFilter(false)
                }}
                onClose={() => setOpenFilter(false)}
              />
            )}
          </div>
          <div className="control">
            <select
              className="ui-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as FeatureSort)}
              aria-label="Sort features by"
            >
              <option value="index_asc">Ascending ↓</option>
              <option value="index_desc">Descending ↑</option>
              <option value="status_asc">Status ↓</option>
              <option value="status_desc">Status ↑</option>
            </select>
          </div>
        </div>
        <div className="right">
          <button
            type="button"
            className="btn-secondary btn-icon"
            aria-label="Edit task"
            onClick={handleEditTask}
          >
            <IconEdit className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Add feature"
            onClick={handleAddFeature}
          >
            <IconPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
              <IconChevron
                className={`w-4 h-4 icon-chevron ${isOverviewExpanded ? 'expanded' : ''}`}
              />
            </button>
            <h2 className="section-title">Overview</h2>
          </div>
          <div
            id="overview-content"
            className={`overview-content ${isOverviewExpanded ? 'expanded' : 'collapsed'}`}
          >
            <p className="task-desc">
              <RichText text={task.description || 'No description provided.'} />
            </p>
          </div>
        </section>

        <section className="panel flex flex-col flex-1 min-h-0">
          <div className="section-header shrink-0">
            <h2 className="section-title">Features</h2>
          </div>

          {featuresFiltered.length === 0 ? (
            <div className="flex-1 min-h-0 overflow-y-auto empty">No features found.</div>
          ) : (
            <ul
              className={`flex-1 min-h-0 overflow-y-auto features-list ${dragging ? 'dnd-active' : ''}`}
              role="list"
              aria-label="Features"
              ref={ulRef}
              onDragOver={(e) => {
                if (dndEnabled) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }
              }}
              onDrop={(e) => {
                if (!dndEnabled || !dragging) return
                e.preventDefault()
                preventDragFromNoDragRef.current = false
                onListDrop()
              }}
              onDragEnd={() => {
                preventDragFromNoDragRef.current = false
                clearDndState()
              }}
            >
              {featuresFiltered.map((f: Feature, idx: number) => {
                const blockers = getBlockers(task.id, f.id)
                const blockersOutbound = getBlockersOutbound(f.id)

                const isDragSource = dragFeatureId === f.id
                const isDropBefore = dragging && dropIndex === idx && dropPosition === 'before'
                const isDropAfter = dragging && dropIndex === idx && dropPosition === 'after'

                const featureTaskRun = runsHistory.find(
                  (r) => r.state === 'running' && r.taskId === task.id,
                )
                const featureConversation = taskRun?.conversations.find((c) => c.featureId === f.id)
                const featureHasActiveRun = !!featureConversation

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
                      onPointerUpCapture={() => {
                        preventDragFromNoDragRef.current = false
                      }}
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
                      onDragOver={(e) => {
                        if (!dndEnabled) return
                        e.preventDefault()
                        computeDropForRow(e, idx)
                      }}
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
                        {f.rejection && (
                          <ExclamationChip title={f.rejection} tooltip="Has rejection reason" />
                        )}
                      </div>

                      <div className="col col-title">
                        <span className="title-text">
                          <RichText text={f.title || ''} />
                        </span>
                      </div>
                      <div className="col col-description" title={f.description || ''}>
                        <RichText text={f.description || ''} />
                      </div>
                      <div className="col col-actions">
                        {!featureHasActiveRun && (
                          <RunAgentButton
                            onClick={(agentType) => {
                              if (!projectId || featureHasActiveRun) return
                              startFeatureAgent(agentType, projectId, task.id, f.id)
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{ gridRow: 3, gridColumn: 2 }}
                        className="flex items-center justify-between gap-8"
                        aria-label={`Blockers and actions for Feature ${f.id}`}
                      >
                        <div className="flex gap-8">
                          <div className="chips-list">
                            <span className="chips-sub__label">References</span>
                            {blockers.length === 0 ? (
                              <span className="chips-sub__label" title="No dependencies">
                                None
                              </span>
                            ) : (
                              blockers.map((d) => <DependencyBullet key={d.id} dependency={d.id} />)
                            )}
                          </div>
                          <div className="chips-list">
                            <span className="chips-sub__label">Blocks</span>
                            {blockersOutbound.length === 0 ? (
                              <span className="chips-sub__label" title="No dependents">
                                None
                              </span>
                            ) : (
                              blockersOutbound.map((d) => (
                                <DependencyBullet key={d.id} dependency={d.id} isOutbound />
                              ))
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 pr-2">
                          {featureHasActiveRun && featureTaskRun && (
                            <div
                              className="flex items-center gap-2"
                              aria-label={`Active agents for Feature ${f.id}`}
                            >
                              <AgentRunBullet
                                key={featureTaskRun.id}
                                run={featureTaskRun}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigateAgentRun(featureTaskRun.id)
                                }}
                              />
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

      {saving && (
        <div
          className="saving-indicator"
          aria-live="polite"
          style={{ position: 'fixed', bottom: 12, right: 16 }}
        >
          Reordering…
        </div>
      )}
    </div>
  )
}
