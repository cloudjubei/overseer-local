import React from 'react'
import { useNavigator } from '../../navigation/Navigator'
import Tooltip from '../ui/Tooltip'
import type { Status } from 'thefactory-tools'
import StorySummaryCallout from './StorySummaryCallout'
import FeatureSummaryCallout from './FeatureSummaryCallout'
import { useStories } from '../../contexts/StoriesContext'
import { IconXCircle } from '../ui/icons/Icons'

export interface DependencyBulletProps {
  className?: string
  dependency: string // format: "storyId" or "featureId" (it's of the format {storyId}.{featureIndex})
  isOutbound?: boolean
  notFoundDependencyDisplay?: string
  onRemove?: () => void
  interactive?: boolean
}

const DependencyBullet: React.FC<DependencyBulletProps> = ({
  className,
  dependency,
  isOutbound = false,
  notFoundDependencyDisplay,
  onRemove,
  interactive = true,
}) => {
  const { navigateStoryDetails, storiesRoute } = useNavigator()
  const { resolveDependency } = useStories()

  const resolved = resolveDependency(dependency)
  const isError = 'code' in resolved
  const isFeatureDependency = !isError && resolved.kind === 'feature'
  const display = isError ? (notFoundDependencyDisplay ?? dependency) : resolved.display

  let summary: { title: string; description: string; status: Status; displayId: string } = {
    title: 'Not found',
    description: '',
    status: '-' as Status,
    displayId: display,
  }

  if (!isError) {
    if (resolved.kind === 'story') {
      summary = {
        title: resolved.story.title,
        description: resolved.story.description,
        status: resolved.story.status as Status,
        displayId: display,
      }
    } else {
      summary = {
        title: resolved.feature.title,
        description: resolved.feature.description,
        status: resolved.feature.status as Status,
        displayId: display,
      }
    }
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

  const content = isFeatureDependency ? (
    <FeatureSummaryCallout {...summary} />
  ) : (
    <StorySummaryCallout {...summary} />
  )

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
    <Tooltip content={content} zIndex={2000}>
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
