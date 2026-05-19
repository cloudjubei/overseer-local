import type { Feature, GetStoryResponse } from 'thefactory-ui/headless/api'
import { FeatureCard as FeatureCardBase, type StoryStatus as Status } from 'thefactory-ui/web'
import DependencyBullet from './DependencyBullet'
import RunAgentButton from '@ui/components/agents/RunAgentButton'

export type FeatureCardProps = {
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

export default function FeatureCard({
  projectId,
  story,
  feature,
  showStatus = true,
  onStatusChange,
  className = '',
  showActions = false,
  isNew = false,
  onPillClick,
}: FeatureCardProps) {
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
        showActions ? (
          <RunAgentButton projectId={projectId} storyId={story.id} featureId={feature.id} />
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
