import type { Feature, GetStoryResponse } from 'thefactory-ui/headless/api'
import {
  featureProcessOverlay,
  isFeatureInLiveRun,
  useProcessRuns,
  useProcessStopClock,
} from 'thefactory-ui/headless'
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
}

/**
 * A feature as a card, wherever one is shown (a chat's tool results). When the
 * story's process run is acting on this feature, the card carries the feature's
 * chip linking to that ONE pipeline (`featureProcessOverlay`) in place of Run —
 * a feature is a node in it, not a place with its own sign-off. A feature the
 * live run carries but has not reached offers no Run either (`isFeatureInLiveRun`). The run is read
 * from `useProcessRuns(projectId)`, the project's one shared list, so a chat
 * full of cards still makes a single read and keeps a single subscription.
 */
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
}: FeatureCardConnectedProps): React.JSX.Element {
  const stopNow = useProcessStopClock()
  const { runs } = useProcessRuns(projectId)
  const processRun = runs.find((r) => r.storyId === story.id)
  const processOverlay = featureProcessOverlay(processRun, feature.id, stopNow)
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
          <ProcessStatusChip run={processRun} projectId={projectId} featureId={feature.id} />
        ) : showActions && !isFeatureInLiveRun(processRun, feature.id) ? (
          <RunAgentButtonConnected
            projectId={projectId}
            storyId={story.id}
            featureId={feature.id}
          />
        ) : undefined
      }
      pinActions={processOverlay !== undefined}
      renderBlocker={(dep) => <DependencyBullet dependency={dep} interactive={false} />}
      showStatus={!isNew && showStatus}
      onStatusChange={onStatusChange}
      className={className}
      ariaLabel={`Feature ${feature.id} ${feature.title}`}
    />
  )
}
