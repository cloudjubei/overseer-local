import type { ReactNode } from 'react'
import {
  renderToolPreview,
  type RenderToolPreviewArgs,
  type ToolPreviewHooks,
} from 'thefactory-ui/web'
import { getToolHeaderPath } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { StoryAndFeatureCallout, StoryCard, type StoryCardData } from 'thefactory-ui/web'
import FeatureCardConnected from '@ui/components/stories/FeatureCardConnected'
import FeatureRequestWidgetConnected from '@ui/components/chat/FeatureRequestWidgetConnected'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'
import { useNavigateToGroupRun } from '@ui/hooks/useNavigateToGroupRun'
import { useNavigate } from 'react-router-dom'
import { DependencyBullet, ProcessGroupRunChip, ProcessRunChip } from 'thefactory-ui/web'
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
  const navigateToResource = useNavigateToResource()
  const navigateToGroupRun = useNavigateToGroupRun()
  const navigate = useNavigate()

  const hooks: ToolPreviewHooks = {
    onResourceLink: navigateToResource,
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
    // The rich card for a completed `addStory` / `updateStory`. Without it the
    // preview renders the field diff alone — the story it belongs to is left
    // unidentified.
    renderStoryCard: (story) => {
      const stored = getStory(story.id)
      const card: StoryCardData = {
        id: story.id,
        title: story.title ?? stored?.title ?? story.id,
        ...((story.description ?? stored?.description)
          ? { description: story.description ?? stored?.description }
          : {}),
        status: (story.status ?? stored?.status ?? 'pending') as StoryCardData['status'],
        ...(stored?.blockers ? { blockers: stored.blockers } : {}),
      }
      return (
        <StoryCard
          story={card}
          renderBlocker={(dep) => <DependencyBullet dependency={dep} />}
          {...(projectId
            ? {
                onClick: () => navigateToResource({ kind: 'story', projectId, storyId: story.id }),
              }
            : {})}
        />
      )
    },
    renderFeatureCard: (story, feature) => {
      const s = getStory(story.id)
      const f = s ? getFeature(s.id, feature.id) : undefined
      if (!s || !f || !projectId) return null
      return <FeatureCardConnected projectId={projectId} story={s} feature={f} />
    },
    // The card REPORTS and never decides: it shows the run's live state and its
    // only action is to open the pipeline, where the decisions are made.
    renderProcessRunLink: ({ processRunId }) => {
      if (!projectId) return null
      return (
        <ProcessRunChip
          processRunId={processRunId}
          onOpen={(id) => navigate(`/projects/${projectId}/process-runs/${id}`)}
        />
      )
    },
    renderProcessGroupRunLink: ({ groupRunId }) => (
      <ProcessGroupRunChip groupRunId={groupRunId} onOpen={(id) => navigateToGroupRun(id)} />
    ),
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
