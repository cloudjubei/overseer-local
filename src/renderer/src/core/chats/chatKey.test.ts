import { describe, expect, it } from 'vitest'
import { getChatContext, getChatContextKey } from './chatKey'
import type { ChatContext } from 'thefactory-ui/headless/api'

/**
 * Round-trip every chat context type through `getChatContextKey` →
 * `getChatContext`. Locks the local port against drift from upstream's
 * `thefactory-tools/src/chats/chatsUtils.ts`.
 */
describe('chatKey', () => {
  const cases: Array<{ name: string; ctx: ChatContext; key: string }> = [
    { name: 'PROJECT', ctx: { type: 'PROJECT', projectId: 'p1' }, key: 'projects/p1' },
    {
      name: 'PROJECT_TOPIC',
      ctx: { type: 'PROJECT_TOPIC', projectId: 'p1', topicId: 't1' },
      key: 'projects/p1/topics/t1',
    },
    {
      name: 'STORY',
      ctx: { type: 'STORY', projectId: 'p1', storyId: 's1' },
      key: 'projects/p1/stories/s1',
    },
    {
      name: 'FEATURE',
      ctx: { type: 'FEATURE', projectId: 'p1', storyId: 's1', featureId: 'f1' },
      key: 'projects/p1/stories/s1/features/f1',
    },
    {
      name: 'AGENT_RUN_STORY',
      ctx: { type: 'AGENT_RUN_STORY', projectId: 'p1', storyId: 's1', agentRunId: 'r1' },
      key: 'projects/p1/stories/s1/agents/r1',
    },
    {
      name: 'AGENT_RUN_FEATURE',
      ctx: {
        type: 'AGENT_RUN_FEATURE',
        projectId: 'p1',
        storyId: 's1',
        featureId: 'f1',
        agentRunId: 'r1',
      },
      key: 'projects/p1/stories/s1/features/f1/agents/r1',
    },
    { name: 'GROUP', ctx: { type: 'GROUP', groupId: 'g1' }, key: 'groups/g1' },
    {
      name: 'GROUP_TOPIC',
      ctx: { type: 'GROUP_TOPIC', groupId: 'g1', topicId: 't1' },
      key: 'groups/g1/topics/t1',
    },
  ]

  for (const c of cases) {
    it(`encodes ${c.name}`, () => {
      expect(getChatContextKey(c.ctx)).toBe(c.key)
    })
    it(`round-trips ${c.name}`, () => {
      const parsed = getChatContext(c.key)
      expect(parsed?.type).toBe(c.ctx.type)
      expect(parsed?.projectId).toBe(c.ctx.projectId)
      expect(parsed?.storyId).toBe(c.ctx.storyId)
      expect(parsed?.featureId).toBe(c.ctx.featureId)
      expect(parsed?.agentRunId).toBe(c.ctx.agentRunId)
      expect(parsed?.groupId).toBe(c.ctx.groupId)
      expect(parsed?.topicId).toBe(c.ctx.topicId)
    })
  }

  it('rejects keys that do not match a known shape', () => {
    expect(getChatContext('')).toBeUndefined()
    expect(getChatContext('foo/bar')).toBeUndefined()
    expect(getChatContext('projects')).toBeUndefined()
    expect(getChatContext('projects/p1/stories')).toBeUndefined()
    expect(getChatContext('projects/p1/something/x')).toBeUndefined()
  })

  it('parses a leading slash defensively', () => {
    expect(getChatContext('/projects/p1')?.type).toBe('PROJECT')
  })

  it('decodes a GENERAL chat with a multi-underscore timestamp', () => {
    const ctx = getChatContext('general_2026-05-01_12:34:56')
    expect(ctx?.type).toBe('GENERAL')
    expect(ctx?.timestamp).toBe('2026-05-01_12:34:56')
  })
})
