import React, { useMemo } from 'react'
import type { ProjectSpec, Status, Story } from 'thefactory-tools'
import Tooltip from '../ui/Tooltip'
import StatusControl from './StatusControl'
import RunAgentButton from './RunAgentButton'
import AgentRunBullet from '../agents/AgentRunBullet'
import { useAgents } from '../../contexts/AgentsContext'
import { useNavigator } from '../../navigation/Navigator'
import { useActiveProject } from '../../contexts/ProjectContext'
import Markdown from '../ui/Markdown'
import DependencyBullet from './DependencyBullet'
import { useStories } from '@renderer/contexts/StoriesContext'

export function StoryCard({
  storyId,
  onClick,
  draggable = false,
  onDragStart,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  onPillClick,
}: {
  storyId: string
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
  className?: String
  showActions?: boolean
  onPillClick?: () => void
}) {
  const { project } = useActiveProject()
  const { storiesById } = useStories()

  const story = useMemo(() => {
    return storiesById[storyId]
  }, [storiesById, storyId])

  //TODO: show nice uknown view
  if (!story || !project) return <span>UNKNOWN STORY</span>

  return (
    <StoryCardRaw
      project={project}
      story={story}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      showStatus={showStatus}
      onStatusChange={onStatusChange}
      className={className}
      showActions={showActions}
      onPillClick={onPillClick}
    />
  )
}
export function StoryCardRaw({
  project,
  story,
  onClick,
  draggable = false,
  onDragStart,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  isNew = false,
  onPillClick,
}: {
  project: ProjectSpec
  story: Story
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
  className?: String
  showActions?: boolean
  isNew?: boolean
  onPillClick?: () => void
}) {
  const { runsHistory, startAgent } = useAgents()
  const { navigateAgentRun } = useNavigator()

  const projectId = project.id
  const storyId = story.id

  const dependency = `${storyId}`

  const storyRun = runsHistory.find(
    (r) =>
      r.state === 'running' && r.context.projectId === projectId && r.context.storyId === storyId,
  )

  return (
    <div
      className={`story-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md group ${className}`}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick && !onStatusChange) return
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
        if (onStatusChange && e.key.toLowerCase() === 's') {
          e.preventDefault()
          const order: Status[] = ['-', '~', '+', '=', '?']
          const current = story.status
          const idx = order.indexOf(current)
          const next = order[(idx + 1) % order.length]
          onStatusChange(next)
        }
      }}
      draggable={draggable}
      onDragStart={onDragStart}
      aria-label={`Story ${story.id} ${story.title}`}
    >
      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
        {isNew ? (
          <span
            className={`id-chip bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 font-bold ${onPillClick ? 'cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/50' : ''}`}
            onClick={(e) => {
              if (onPillClick) {
                e.stopPropagation()
                onPillClick()
              }
            }}
          >
            NEW
          </span>
        ) : (
          <DependencyBullet
            key={dependency}
            dependency={dependency}
            interactive={false}
            disableHoverInfo={true}
          />
        )}
        <div className="story-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
          {showActions && (
            <>
              {storyRun ? (
                <AgentRunBullet
                  key={storyRun.context.agentRunId}
                  run={storyRun}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigateAgentRun(storyRun.context)
                  }}
                />
              ) : (
                <RunAgentButton
                  onClick={(agentType) => {
                    startAgent(agentType, projectId, storyId)
                  }}
                />
              )}
            </>
          )}
          {onClick && showStatus && (
            <Tooltip content="Open details (Enter)" placement="top">
              <button
                className="btn-secondary !px-2 !py-1 text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick()
                }}
                aria-label="Open details"
              >
                ↗
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-2" title={story.title}>
        {story.title}
      </h3>

      {story.description && (
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-2 markdown-container text-ellipsis overflow-hidden">
          <Markdown text={story.description} />
        </div>
      )}

      {story.blockers && story.blockers.length > 0 && (
        <div className="flex flex-wrap items-start gap-1 mb-2">
          {story.blockers.map((dep) => (
            <DependencyBullet key={dep} dependency={dep} interactive={false} />
          ))}
        </div>
      )}

      {!isNew && showStatus && <StatusControl status={story.status} onChange={onStatusChange} />}
    </div>
  )
}
