import type { ReactNode } from 'react'
import type { ToolCall } from 'thefactory-tools'
import {
  renderToolPreview,
  type FeatureShape,
  type StoryShape,
  type ToolPreviewHooks,
} from 'thefactory-ui/web'
import { useStories } from '@renderer/contexts/StoriesContext'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useNavigator } from '@renderer/navigation/Navigator'

import { FeatureCardRaw } from '@renderer/components/stories/FeatureCard'
import { StoryCardRaw } from '@renderer/components/stories/StoryCard'
import DependencyBullet from '@renderer/components/stories/DependencyBullet'
import StoryAndFeatureCallout from '@renderer/components/stories/StoryAndFeatureCallout'
import { extract, tryString } from './utils'

/**
 * Desktop-side `renderToolResult` callback wired against `useStories()` /
 * `useActiveProject()` so the shared `renderToolPreview` registry renders
 * desktop's rich Story / Feature cards. Passed into the shared
 * `<MessageList renderToolResult>` so the in-message ToolCallCard's hover
 * preview uses identical rendering between web and desktop.
 *
 * Implemented as a render-prop so it can call hooks safely (React only
 * allows hooks inside a component context).
 */
export function renderToolCallPreview(args: {
  toolCall: ToolCall
  result?: unknown
  resultType?: unknown
  sideBySide?: boolean
}): ReactNode {
  return <ConnectedToolPreview {...args} />
}

function ConnectedToolPreview({
  toolCall,
  result,
  resultType,
  sideBySide,
}: {
  toolCall: ToolCall
  result?: unknown
  resultType?: unknown
  sideBySide?: boolean
}) {
  const { project } = useActiveProject()
  const { storiesById, featuresById } = useStories()
  const { navigateStoryDetails } = useNavigator()

  const hooks: ToolPreviewHooks = {
    getStory: (id) => {
      const s = storiesById[id]
      if (!s) return undefined
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status,
        features: (s.features ?? []).map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
        })),
      }
    },
    getFeature: (_storyId, featureId) => {
      const f = featuresById[featureId]
      if (!f) return undefined
      return { id: f.id, title: f.title, description: f.description, status: f.status }
    },
    renderStoryCard: (story: StoryShape) => {
      if (!project) return null
      const full = storiesById[story.id]
      return (
        <StoryCardRaw
          project={project}
          story={full ?? (story as any)}
          isNew={!full}
          onPillClick={full ? () => navigateStoryDetails(full.id, undefined, true) : undefined}
        />
      )
    },
    renderFeatureCard: (story: StoryShape, feature: FeatureShape) => {
      if (!project) return null
      const fullStory = storiesById[story.id] ?? (story as any)
      const fullFeature = featuresById[feature.id] ?? (feature as any)
      return (
        <FeatureCardRaw
          project={project}
          story={fullStory}
          feature={fullFeature}
          onPillClick={
            fullStory?.id && fullFeature?.id
              ? () => navigateStoryDetails(fullStory.id, fullFeature.id)
              : undefined
          }
        />
      )
    },
    renderStoryBullet: (storyId: string) => <DependencyBullet dependency={storyId} />,
    renderStoryAndFeatureCallout: ({ storyId, featureId }) => (
      <StoryAndFeatureCallout storyId={storyId} featureId={featureId} />
    ),
  }

  return (
    <>
      {renderToolPreview({
        toolCall,
        result,
        resultType: resultType as never,
        sideBySide,
        hooks,
      })}
    </>
  )
}

/**
 * Header-path computer mirroring desktop's local `getToolHeaderPath`.
 * Shows e.g. the file path under the tool name inside `ToolCallCard`.
 */
export function getToolHeaderPath(toolCall: ToolCall): string | undefined {
  const args = (toolCall?.arguments || {}) as Record<string, unknown>
  switch (toolCall.name) {
    case 'writeFile':
    case 'readFileStructure':
    case 'listContents':
    case 'getAstOutline':
      return tryString(extract(args, ['path']))
    case 'addFeature':
    case 'updateStory':
    case 'updateFeature':
    case 'reorderFeature':
    case 'finishFeature':
    case 'blockFeature': {
      const storyId = tryString(extract(args, ['storyId']))
      const featureId = tryString(extract(args, ['featureId']))
      if (storyId && featureId) return `story ${storyId} / feature ${featureId}`
      if (storyId) return `story ${storyId}`
      return undefined
    }
    default:
      return undefined
  }
}
