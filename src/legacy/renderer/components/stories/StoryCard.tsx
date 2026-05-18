import { useMemo } from 'react'
import type { ProjectSpec, Status, Story } from 'thefactory-tools'
import {
  RunAgentButton,
  StoryCard as StoryCardBase,
  Tooltip,
  type StoryStatus as UikitStatus,
} from 'thefactory-ui/web'
import AgentRunBullet from '../agents/AgentRunBullet'
import { useAgents } from '../../contexts/AgentsContext'
import { useNavigator } from '../../navigation/Navigator'
import { useActiveProject } from '../../contexts/ProjectContext'
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
  className?: string
  showActions?: boolean
  onPillClick?: () => void
}) {
  const { project } = useActiveProject()
  const { storiesById } = useStories()

  const story = useMemo(() => storiesById[storyId], [storiesById, storyId])

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
  className?: string
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

  const headerLeft = isNew ? (
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
    <DependencyBullet dependency={dependency} interactive={false} disableHoverInfo />
  )

  const actions =
    showActions || (onClick && showStatus) ? (
      <>
        {showActions &&
          (storyRun ? (
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
          ))}
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
      </>
    ) : undefined

  return (
    <StoryCardBase
      story={story as { id: string; title: string; description?: string; status: UikitStatus; blockers?: string[] }}
      headerLeft={headerLeft}
      actions={actions}
      renderBlocker={(dep) => <DependencyBullet dependency={dep} interactive={false} />}
      showStatus={!isNew && showStatus}
      onStatusChange={onStatusChange as ((s: UikitStatus) => void) | undefined}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={className}
      ariaLabel={`Story ${story.id} ${story.title}`}
    />
  )
}
