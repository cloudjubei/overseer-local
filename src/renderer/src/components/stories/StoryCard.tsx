import React from 'react'
import type { Status, ProjectSpec, Story } from 'thefactory-tools'
import Tooltip from '../ui/Tooltip'
import StatusControl from './StatusControl'
import RunAgentButton from './RunAgentButton'
import AgentRunBullet from '../agents/AgentRunBullet'
import { useAgents } from '../../contexts/AgentsContext'
import { useNavigator } from '../../navigation/Navigator'
import { useProjectContext } from '../../contexts/ProjectContext'

export default function StoryCard({
  project,
  story,
  onClick,
  draggable = false,
  onDragStart,
  showStatus = true,
  onStatusChange,
}: {
  project: ProjectSpec
  story: Story
  onClick?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
}) {
  const { runsHistory, startAgent } = useAgents()
  const { navigateAgentRun } = useNavigator()
  const { getStoryDisplayIndex } = useProjectContext()
  const storyRun = runsHistory.find((r) => r.state === 'running' && r.context.storyId === story.id)

  return (
    <div
      className="story-card group"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
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
      <div className="story-card__header">
        <span className="id-chip">{getStoryDisplayIndex(project.id, story.id)}</span>
        <div className="flex-spacer" />
        <div className="story-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
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
                startAgent(agentType, project.id, story.id)
              }}
            />
          )}
        </div>
      </div>
      <div className="story-card__title" title={story.title}>
        {story.title}
      </div>
      {showStatus && (
        <div className="story-card__meta flex items-center justify-between gap-2">
          <StatusControl status={story.status} onChange={onStatusChange} />
          <div className="story-card__actions opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150 ease-out flex items-center gap-2">
            <Tooltip content="Open details (Enter)" placement="top">
              <button
                className="btn-secondary !px-2 !py-1 text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onClick?.()
                }}
                aria-label="Open details"
              >
                ↗
              </button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  )
}