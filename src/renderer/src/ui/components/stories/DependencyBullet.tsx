import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DependencyBullet as DependencyBulletBase,
  type ResolvedDependency,
  type StoryStatus,
} from 'thefactory-ui/web'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useStories } from '@core/contexts/StoriesContext'

export interface DependencyBulletProps {
  className?: string
  /** `"storyUuid"` / `"storyUuid.featureUuid"` (or display-index form
   *  `"3"` / `"3.2"`, which the resolver normalises). */
  dependency: string
  isOutbound?: boolean
  notFoundDependencyDisplay?: string
  onRemove?: () => void
  interactive?: boolean
  disableHoverInfo?: boolean
}

/**
 * Web wrapper around the shared `DependencyBullet`. Resolves the dep
 * string through `StoriesContext` into the structural shape the shared
 * component expects, and wires `onClick` to react-router navigation.
 */
export default function DependencyBullet({
  className = '',
  dependency,
  isOutbound = false,
  notFoundDependencyDisplay,
  onRemove,
  interactive = true,
  disableHoverInfo = false,
}: DependencyBulletProps) {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const { projectId: activeProjectId } = useActiveProject()
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
        const targetProjectId = activeProjectId ?? urlProjectId
        if (!targetProjectId) return
        navigate(`/projects/${targetProjectId}/stories/${r.storyId}`)
      }}
    />
  )
}
