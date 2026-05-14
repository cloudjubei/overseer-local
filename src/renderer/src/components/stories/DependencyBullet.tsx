import React from 'react'
import { useNavigator } from '../../navigation/Navigator'
import { DependencyChip, StatusControl } from 'thefactory-ui/web'
import { StoryCard } from './StoryCard'
import { FeatureCard } from './FeatureCard'
import { useStories } from '../../contexts/StoriesContext'

export interface DependencyBulletProps {
  className?: string
  /** `"storyUuid"` or `"storyUuid.featureUuid"` (or the display-index form
   *  `"3"` / `"3.2"`, which the resolver normalises). */
  dependency: string
  isOutbound?: boolean
  notFoundDependencyDisplay?: string
  onRemove?: () => void
  interactive?: boolean
  disableHoverInfo?: boolean
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({
  className,
  dependency,
  isOutbound = false,
  notFoundDependencyDisplay,
  onRemove,
  interactive = true,
  disableHoverInfo = false,
}) => {
  const { navigateStoryDetails, storiesRoute } = useNavigator()
  const { resolveDependency } = useStories()

  const resolved = resolveDependency(dependency)
  const isError = 'code' in resolved
  const display = isError ? (notFoundDependencyDisplay ?? dependency) : resolved.display

  let tooltipContent: React.ReactNode
  if (isError) {
    tooltipContent = (
      <div className="summary-card p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md max-w-xs">
        <div className="text-xs text-gray-500 mb-1">Not found</div>
        <h3 className="text-lg font-semibold mb-2">Not found</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          The requested dependency could not be resolved.
        </p>
        <StatusControl status="-" />
      </div>
    )
  } else if (resolved.kind === 'story') {
    tooltipContent = <StoryCard storyId={resolved.storyId} className="max-w-xs" />
  } else {
    tooltipContent = (
      <FeatureCard
        storyId={resolved.storyId}
        featureId={resolved.featureId}
        className="max-w-xs"
      />
    )
  }

  const handleClick = () => {
    if (isError) return
    const targetStoryId = resolved.kind === 'story' ? resolved.id : resolved.storyId
    const featureId = resolved.kind === 'feature' ? resolved.featureId : undefined

    const isSameStory = storiesRoute.name === 'details' && storiesRoute.storyId === targetStoryId
    if (isSameStory) {
      if (featureId) {
        const row = document.querySelector(`.feature-row[data-feature-id="${featureId}"]`)
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' })
          row.classList.add('highlighted')
          setTimeout(() => row.classList.remove('highlighted'), 2000)
        }
      } else {
        const element = document.querySelector('.details-header')
        if (element) {
          element.scrollIntoView({ block: 'start', behavior: 'smooth' })
          element.classList.add('highlighted')
          setTimeout(() => element.classList.remove('highlighted'), 2000)
        }
      }
    } else {
      navigateStoryDetails(targetStoryId, featureId, !featureId)
    }
  }

  return (
    <DependencyChip
      className={className}
      display={display}
      kind={isError ? 'missing' : resolved.kind}
      variant={isError ? 'missing' : isOutbound ? 'blocks' : 'ok'}
      tooltip={tooltipContent}
      disableHoverInfo={disableHoverInfo}
      interactive={interactive}
      onClick={handleClick}
      onRemove={onRemove}
      title={`${display}${isOutbound ? ' (requires this)' : ''}`}
    />
  )
}

export default DependencyBullet
