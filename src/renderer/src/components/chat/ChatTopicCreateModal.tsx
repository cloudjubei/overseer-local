import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { useActiveProject } from '@renderer/contexts/ProjectContext'
import { useProjectsGroups } from '@renderer/contexts/ProjectsGroupsContext'
import { useStories } from '@renderer/contexts/StoriesContext'
import type {
  ChatContext,
  ChatContextGroupTopic,
  ChatContextProjectTopic,
  ChatContextStoryTopic,
} from 'thefactory-tools'

type Props = {
  isOpen: boolean
  onClose: () => void
  onTopicCreated: (ctx: ChatContext) => void
}

export default function ChatTopicCreateModal({ isOpen, onClose, onTopicCreated }: Props) {
  const { projectId: activeProjectId } = useActiveProject()
  const { activeSelectionType, activeGroupId } = useProjectsGroups()
  const { storiesById, storyIdsByProject } = useStories()

  const [topicName, setTopicName] = useState('')
  const [targetType, setTargetType] = useState<'group' | 'project' | 'story'>('project')
  const [selectedStoryId, setSelectedStoryId] = useState<string>('')

  // Initialize selected target
  useEffect(() => {
    if (isOpen) {
      setTopicName('')
      if (activeSelectionType === 'group') {
        setTargetType('group')
      } else {
        setTargetType('project')
      }
    }
  }, [isOpen, activeSelectionType])

  const activeStories = useMemo(() => {
    if (activeProjectId) {
      const stories = storyIdsByProject[activeProjectId]
        .map((id) => storiesById[id])
        .filter(Boolean)
      return stories.sort((a, b) => a.title.localeCompare(b.title))
    }
    return []
  }, [activeProjectId, storyIdsByProject, storiesById])

  useEffect(() => {
    if (targetType === 'story' && !selectedStoryId && activeStories.length > 0) {
      setSelectedStoryId(activeStories[0].id)
    }
  }, [targetType, selectedStoryId, activeStories])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!topicName.trim()) return

    const sanitizedTopic = topicName.trim().replace(/\s+/g, '_')
    let ctx: ChatContext | undefined

    if (targetType === 'group' && activeGroupId) {
      ctx = {
        type: 'GROUP_TOPIC',
        groupId: activeGroupId,
        groupTopic: sanitizedTopic,
      } as ChatContextGroupTopic
    } else if (targetType === 'project' && activeProjectId) {
      ctx = {
        type: 'PROJECT_TOPIC',
        projectId: activeProjectId,
        projectTopic: sanitizedTopic,
      } as ChatContextProjectTopic
    } else if (targetType === 'story' && selectedStoryId) {
      ctx = {
        type: 'STORY_TOPIC',
        storyId: selectedStoryId,
        storyTopic: sanitizedTopic,
      } as ChatContextStoryTopic
    }

    if (ctx) {
      onTopicCreated(ctx)
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Topic"
      size="sm"
      initialFocusRef={undefined}
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => handleSubmit()}
            disabled={!topicName.trim() || (targetType === 'story' && !selectedStoryId)}
          >
            Create
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
            Topic Name
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md bg-[var(--surface-raised)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            placeholder="e.g. Planning, Architecture"
            value={topicName}
            onChange={(e) => setTopicName(e.target.value)}
            autoFocus
          />
        </div>

        {activeSelectionType === 'project' && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Topic Context
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  name="targetType"
                  value="project"
                  checked={targetType === 'project'}
                  onChange={() => setTargetType('project')}
                  className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                Project Level
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="radio"
                  name="targetType"
                  value="story"
                  checked={targetType === 'story'}
                  onChange={() => setTargetType('story')}
                  className="w-4 h-4 text-[var(--accent-primary)] focus:ring-[var(--accent-primary)]"
                />
                Story Level
              </label>
            </div>
          </div>
        )}

        {targetType === 'story' && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Select Story
            </label>
            <select
              className="w-full px-3 py-2 border border-[var(--border-default)] rounded-md bg-[var(--surface-raised)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              value={selectedStoryId}
              onChange={(e) => setSelectedStoryId(e.target.value)}
            >
              {activeStories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
              {activeStories.length === 0 && <option value="">No stories available</option>}
            </select>
          </div>
        )}
      </form>
    </Modal>
  )
}
