import { useMemo } from 'react'
import type { Feature, ProjectSpec, Status, Story } from 'thefactory-tools'
import {
  FeatureCard as FeatureCardBase,
  RunAgentButton,
  type StoryStatus as UikitStatus,
} from 'thefactory-ui/web'
import DependencyBullet from './DependencyBullet'
import { useAgents } from '@renderer/contexts/AgentsContext'
import { useNavigator } from '@renderer/navigation/Navigator'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import AgentRunBullet from '../agents/AgentRunBullet'

export function FeatureCard({
  storyId,
  featureId,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  onPillClick,
}: {
  storyId: string
  featureId: string
  showStatus?: boolean
  onStatusChange?: (status: Status) => void | Promise<void>
  className?: string
  showActions?: boolean
  onPillClick?: () => void
}) {
  const { project } = useActiveProject()
  const { storiesById, featuresById } = useStories()

  const story = useMemo(() => storiesById[storyId], [storiesById, storyId])
  const feature = useMemo(() => featuresById[featureId], [featuresById, featureId])

  if (!feature || !story || !project) return <span>UNKNOWN FEATURE</span>

  return (
    <FeatureCardRaw
      project={project}
      story={story}
      feature={feature}
      showStatus={showStatus}
      onStatusChange={onStatusChange}
      className={className}
      showActions={showActions}
      onPillClick={onPillClick}
    />
  )
}

export function FeatureCardRaw({
  project,
  story,
  feature,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  isNew = false,
  onPillClick,
}: {
  project: ProjectSpec
  story: Story
  feature: Feature
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
  const featureId = feature.id
  const dependency = `${storyId}.${featureId}`

  const featureRun = runsHistory.find(
    (r) =>
      r.state === 'running' &&
      r.context.projectId === projectId &&
      r.context.storyId === storyId &&
      r.context.featureId === featureId,
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

  const actions = showActions ? (
    featureRun ? (
      <AgentRunBullet
        key={featureRun.context.agentRunId}
        run={featureRun}
        onClick={(e) => {
          e.stopPropagation()
          navigateAgentRun(featureRun.context)
        }}
      />
    ) : (
      <RunAgentButton
        onClick={(agentType) => {
          startAgent(agentType, projectId, storyId, featureId)
        }}
      />
    )
  ) : undefined

  return (
    <FeatureCardBase
      feature={feature as { id: string; title: string; description?: string; status: UikitStatus; blockers?: string[] }}
      headerLeft={headerLeft}
      actions={actions}
      renderBlocker={(dep) => <DependencyBullet dependency={dep} interactive={false} />}
      showStatus={!isNew && showStatus}
      onStatusChange={onStatusChange as ((s: UikitStatus) => void) | undefined}
      className={className}
      ariaLabel={`Feature ${feature.id} ${feature.title}`}
    />
  )
}
