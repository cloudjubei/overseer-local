import type { Feature, GetStoryResponse } from 'thefactory-ui/headless/api'
import { processStatusOverlay, type ProcessRun } from 'thefactory-ui/headless'
import { FeatureCard as FeatureCardBase, type StoryStatus as Status } from 'thefactory-ui/web'
import { DependencyBullet } from 'thefactory-ui/web'
import RunAgentButtonConnected from '@ui/components/agents/RunAgentButtonConnected'
import ProcessStatusChip from '@ui/components/stories/ProcessStatusChip'

export type FeatureCardConnectedProps = {
  projectId: string
  story: GetStoryResponse
  feature: Feature
  showStatus?: boolean
  onStatusChange?: (status: Status) => void
  className?: string
  showActions?: boolean
  isNew?: boolean
  onPillClick?: () => void
  /**
   * The story's process run (passed down so the card costs no subscription). When
   * a process owns the story, the card links to that ONE pipeline — a feature is a
   * node in it, not a place with its own separate sign-off.
   */
  processRun?: ProcessRun
}

export default function FeatureCardConnected({
  projectId,
  story,
  feature,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  isNew = false,
  onPillClick,
  processRun,
}: FeatureCardConnectedProps) {
  const processOverlay = processStatusOverlay(processRun)
  const dependency = `${story.id}.${feature.id}`

  const headerLeft = isNew ? (
    <span
      className={`id-chip font-bold ${onPillClick ? 'cursor-pointer hover:bg-(--surface-muted)' : ''}`}
      style={{
        background: 'color-mix(in srgb, var(--color-blue-600) 12%, transparent)',
        color: 'var(--color-blue-700)',
        borderColor: 'var(--color-blue-300)',
      }}
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

  return (
    <FeatureCardBase
      feature={feature}
      headerLeft={headerLeft}
      actions={
        processOverlay ? (
          <ProcessStatusChip run={processRun} projectId={projectId} />
        ) : showActions ? (
          <RunAgentButtonConnected
            projectId={projectId}
            storyId={story.id}
            featureId={feature.id}
          />
        ) : undefined
      }
      renderBlocker={(dep) => <DependencyBullet dependency={dep} interactive={false} />}
      showStatus={!isNew && showStatus}
      onStatusChange={onStatusChange}
      className={className}
      ariaLabel={`Feature ${feature.id} ${feature.title}`}
    />
  )
}
