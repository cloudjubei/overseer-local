import { useMemo } from 'react'
import {
  DependencyBullet as DependencyBulletBase,
  type ResolvedDependency,
  type StoryStatus,
} from 'thefactory-ui/web'
import { useNavigator } from '../../navigation/Navigator'
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

/**
 * Desktop wrapper around the shared `DependencyBullet`. Resolves the dep
 * string through `StoriesContext` into the structural shape the shared
 * component expects, and wires `onClick` to the Navigator (with the
 * same-page scroll-to-feature behaviour preserved).
 */
export default function DependencyBullet({
  className,
  dependency,
  isOutbound = false,
  notFoundDependencyDisplay,
  onRemove,
  interactive = true,
  disableHoverInfo = false,
}: DependencyBulletProps) {
  const { navigateStoryDetails, storiesRoute } = useNavigator()
  const { resolveDependency } = useStories()

  const resolved: ResolvedDependency | null = useMemo(() => {
    const ref = resolveDependency(dependency)
    if ('code' in ref) return null
    if (ref.kind === 'feature') {
      return {
        kind: 'feature',
        display: ref.display,
        storyId: ref.storyId,
        featureId: ref.featureId,
        feature: {
          id: ref.feature.id,
          title: ref.feature.title,
          description: ref.feature.description,
          status: ref.feature.status as StoryStatus,
          blockers: ref.feature.blockers,
        },
      }
    }
    return {
      kind: 'story',
      display: ref.display,
      storyId: ref.storyId,
      story: {
        id: ref.story.id,
        title: ref.story.title,
        description: ref.story.description,
        status: ref.story.status as StoryStatus,
        blockers: ref.story.blockers,
      },
    }
  }, [resolveDependency, dependency])

  return (
    <DependencyBulletBase
      resolved={resolved}
      className={className}
      dependency={dependency}
      notFoundDisplay={notFoundDependencyDisplay}
      isOutbound={isOutbound}
      onRemove={onRemove}
      interactive={interactive}
      disableHoverInfo={disableHoverInfo}
      onClick={(r) => {
        if (r.kind === 'missing') return
        const targetStoryId = r.storyId
        const featureId = r.kind === 'feature' ? r.featureId : undefined

        const isSameStory =
          storiesRoute.name === 'details' && storiesRoute.storyId === targetStoryId
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
      }}
    />
  )
}
