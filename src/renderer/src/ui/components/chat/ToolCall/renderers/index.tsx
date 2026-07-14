import type { ReactNode } from 'react'
import {
  renderToolPreview,
  type RenderToolPreviewArgs,
  type ToolPreviewHooks,
} from 'thefactory-ui/web'
import { getToolHeaderPath } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { StoryAndFeatureCallout } from 'thefactory-ui/web'
import FeatureCardConnected from '@ui/components/stories/FeatureCardConnected'
import FeatureRequestWidgetConnected from '@ui/components/chat/FeatureRequestWidgetConnected'
import { DependencyBullet } from 'thefactory-ui/web'
import type { ToolCall } from '../types'

export { getToolHeaderPath }

/**
 * Web wrapper around the shared `renderToolPreview` registry in
 * `thefactory-ui`. Injects host-specific lookups (stories / features /
 * projects) + story-card / feature-card renderers so the hover preview
 * renders identically to desktop.
 *
 * Exposed as the `renderToolCall` callback that `MessageList` forwards to
 * every `ToolCallCard`.
 */
export function renderToolCall(props: {
  toolCall: ToolCall
  result?: unknown
  resultType?: unknown
}): ReactNode {
  // Hook into web's contexts via a tiny inner component — `renderToolCall`
  // itself is invoked from MessageRow (a component) so it's a render-prop,
  // which lets us call `useStories()` / `useActiveProject()` legally.
  return <ConnectedToolPreview {...(props as RenderToolPreviewArgs)} />
}

function ConnectedToolPreview(args: RenderToolPreviewArgs) {
  const { getStory, getFeature } = useStories()
  const { projectId } = useActiveProject()

  const hooks: ToolPreviewHooks = {
    getStory: (id) => {
      const s = getStory(id)
      if (!s) return undefined
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status as string | undefined,
        features: (s.features ?? []).map((f) => ({
          id: f.id,
          title: f.title,
          description: f.description,
        })),
      }
    },
    getFeature: (storyId, featureId) => {
      const f = getFeature(storyId, featureId)
      if (!f) return undefined
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        status: f.status as string | undefined,
      }
    },
    renderFeatureCard: (story, feature) => {
      const s = getStory(story.id)
      const f = s ? getFeature(s.id, feature.id) : undefined
      if (!s || !f || !projectId) return null
      return <FeatureCardConnected projectId={projectId} story={s} feature={f} />
    },
    renderStoryBullet: (storyId) => <DependencyBullet dependency={storyId} />,
    renderStoryAndFeatureCallout: ({ storyId, featureId }) => (
      <StoryAndFeatureCallout storyId={storyId} featureId={featureId} />
    ),
    renderFeatureRequestWidget: ({ requestId, status, cycleDetected }) => (
      <FeatureRequestWidgetConnected
        requestId={requestId}
        status={status}
        cycleDetected={cycleDetected}
      />
    ),
  }

  return <>{renderToolPreview({ ...args, hooks })}</>
}
