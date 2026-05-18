import { useMemo } from 'react'
import { useChats } from '@core/contexts/ChatsContext'
import { useStories } from '@core/contexts/StoriesContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import type { ChatContext } from '@generated/backend'
import { interpolatePrompt, SystemPromptViewerModal, type PromptVariables } from 'thefactory-ui/web'

export type SystemPromptViewerConnectedProps = {
  isOpen: boolean
  onClose: () => void
  context: ChatContext
}

/**
 * Web wrapper around the shared `SystemPromptViewerModal`. Pulls the
 * stored template off `ChatsContext.getEffectiveChatSettings` and
 * interpolates `{{project_title}}` / `{{story_title}}` / etc. with the
 * current project/story/feature so the modal shows what the agent will
 * actually receive — mirrors desktop's `effectivePrompt` flow.
 */
export default function SystemPromptViewerConnected({
  isOpen,
  onClose,
  context,
}: SystemPromptViewerConnectedProps) {
  const { getEffectiveChatSettings } = useChats()
  const { project } = useActiveProject()
  const { getStory, getFeature } = useStories()

  const prompt = useMemo(() => {
    if (!isOpen) return ''
    const template = getEffectiveChatSettings(context).systemPrompt ?? ''
    if (!template) return ''
    const story = context.storyId ? getStory(context.storyId) : undefined
    const feature =
      context.storyId && context.featureId
        ? getFeature(context.storyId, context.featureId)
        : undefined
    const vars: PromptVariables = {
      project: project
        ? { id: project.id, title: project.title, description: project.description }
        : undefined,
      story: story
        ? {
            id: story.id,
            title: story.title,
            description: story.description,
            features: story.features,
          }
        : undefined,
      feature: feature
        ? { id: feature.id, title: feature.title, description: feature.description }
        : undefined,
    }
    return interpolatePrompt(template, vars)
  }, [isOpen, context, getEffectiveChatSettings, project, getStory, getFeature])

  if (!isOpen) return null
  return <SystemPromptViewerModal isOpen onClose={onClose} title="System Prompt" prompt={prompt} />
}
