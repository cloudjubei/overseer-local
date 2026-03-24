import React from 'react'
import { useNavigator } from '../../navigation/Navigator'
import Tooltip from '../ui/Tooltip'
import { StoryCard } from './StoryCard'
import { FeatureCard } from './FeatureCard'
import StatusControl from './StatusControl'
import { useStories } from '../../contexts/StoriesContext'
import { IconXCircle } from '../ui/icons/Icons'

export interface DependencyBulletProps {
  className?: string
  dependency: string // format: "storyId" or "featureId" (it's of the format {storyId}.{featureIndex})
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
  const isFeatureDependency = !isError && resolved.kind === 'feature'
  const display = isError ? (notFoundDependencyDisplay ?? dependency) : resolved.display

  let content: React.ReactNode
  if (isError) {
    content = (
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
    const { storyId } = resolved
    content = (
      <StoryCard
        storyId={storyId}
        className="max-w-xs !border-0 shadow-none !bg-transparent dark:!bg-transparent"
      />
    )
  } else {
    const { storyId, featureId } = resolved
    content = (
      <FeatureCard
        storyId={storyId}
        featureId={featureId}
        className="max-w-xs !border-0 shadow-none !bg-transparent dark:!bg-transparent"
      />
    )
  }

  const handleClick = () => {
    if (!interactive) return
    if (onRemove) {
      onRemove()
      return
    }
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

  const spanProps: React.HTMLAttributes<HTMLSpanElement> = {}
  if (interactive) {
    spanProps.onClick = (e) => {
      e.preventDefault()
      handleClick()
    }
    spanProps.role = 'button'
    spanProps.tabIndex = 0
    spanProps.onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    }
  }

  return (
    <Tooltip
      placement="bottom"
      allowedPlacements={['bottom', 'top', 'right', 'left']}
      content={content}
      zIndex={2000}
      disabled={disableHoverInfo}
    >
      <span
        className={`${className} chip  ${isError ? '' : isFeatureDependency ? 'feature' : 'story'} ${isError ? 'chip--missing' : isOutbound ? 'chip--blocks' : 'chip--ok'}`}
        title={`${display}${isOutbound ? ' (requires this)' : ''}`}
        {...spanProps}
      >
        #{display}
        {onRemove && <IconXCircle className="w-3.5 h-3" />}
      </span>
    </Tooltip>
  )
}

export default DependencyBullet
