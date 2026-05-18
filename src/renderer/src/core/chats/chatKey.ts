/**
 * Pure ports of `getChatContextKey` / `getChatContext` from
 * `thefactory-tools/utils`. Reimplemented locally because the web app
 * has a hard rule against depending on `thefactory-tools` (per
 * ARCHITECTURE.md). Keep in sync with the upstream definition at
 * `thefactory-tools/src/chats/chatsUtils.ts`.
 *
 * The returned key is the canonical route slug used by the URL deep link
 * `/projects/:projectId/chat/:contextKey`.
 */

import type { ChatContext } from '../../generated/backend'

const PROJECTS = 'projects'
const GROUPS = 'groups'

export function getChatContextKey(c: ChatContext): string {
  if (c.groupId) {
    if (c.topicId) return `${GROUPS}/${c.groupId}/topics/${c.topicId}`
    return `${GROUPS}/${c.groupId}`
  }
  if (c.projectId) {
    if (c.topicId) return `${PROJECTS}/${c.projectId}/topics/${c.topicId}`
    if (c.storyId) {
      if (c.featureId) {
        if (c.agentRunId) {
          return `${PROJECTS}/${c.projectId}/stories/${c.storyId}/features/${c.featureId}/agents/${c.agentRunId}`
        }
        return `${PROJECTS}/${c.projectId}/stories/${c.storyId}/features/${c.featureId}`
      }
      if (c.agentRunId) {
        return `${PROJECTS}/${c.projectId}/stories/${c.storyId}/agents/${c.agentRunId}`
      }
      return `${PROJECTS}/${c.projectId}/stories/${c.storyId}`
    }
    return `${PROJECTS}/${c.projectId}`
  }
  return `/general_${c.timestamp ?? ''}`
}

export function getChatContext(key: string): ChatContext | undefined {
  const normalized = key.startsWith('/') ? key.slice(1) : key
  const parts = normalized.split('/')
  if (parts.length < 1) return undefined

  // GENERAL: 'general_<timestamp>' (no directories)
  if (parts.length === 1) {
    const general = parts[0].split('_')
    if (general.length < 2) return undefined
    return { type: 'GENERAL', timestamp: general.slice(1).join('_') }
  }

  if (parts[0] === GROUPS) {
    const groupId = parts[1]
    if (!groupId) return undefined
    if (parts.length === 4 && parts[2] === 'topics') {
      return { type: 'GROUP_TOPIC', groupId, topicId: parts[3] }
    }
    if (parts.length !== 2) return undefined
    return { type: 'GROUP', groupId }
  }

  if (parts[0] !== PROJECTS) return undefined
  const projectId = parts[1]
  if (!projectId) return undefined

  if (parts.length === 2) return { type: 'PROJECT', projectId }
  if (parts.length < 3) return undefined

  const part2 = parts[2]

  if (parts.length === 4 && part2 === 'topics') {
    return { type: 'PROJECT_TOPIC', projectId, topicId: parts[3] }
  }

  if (part2 === 'stories') {
    if (parts.length < 4) return undefined
    const storyId = parts[3]
    if (parts.length === 4) return { type: 'STORY', projectId, storyId }
    const entityType = parts[4]
    if (entityType === 'features') {
      const featureId = parts[5]
      if (parts.length === 6) {
        return { type: 'FEATURE', projectId, storyId, featureId }
      }
      if (parts.length === 8 && parts[6] === 'agents') {
        return {
          type: 'AGENT_RUN_FEATURE',
          projectId,
          storyId,
          featureId,
          agentRunId: parts[7],
        }
      }
    }
    if (parts.length === 6 && entityType === 'agents') {
      return {
        type: 'AGENT_RUN_STORY',
        projectId,
        storyId,
        agentRunId: parts[5],
      }
    }
    return undefined
  }

  return undefined
}
