import { describe, expect, it } from 'vitest'
import { getChatContext, getChatContextKey } from './chatKey'
import type { ChatContext } from 'thefactory-ui/headless/api'

/**
 * Smoke-test the re-export from `thefactory-tools/utils` and lock in the
 * canonical key form the rest of the renderer (URL slugs, cost-aggregate
 * lookups) depends on. If upstream ever changes the form, this test
 * fails loudly here instead of silently breaking the cost wiring.
 */
describe('chatKey', () => {
  const cases: Array<{ name: string; ctx: ChatContext; key: string }> = [
    { name: 'PROJECT', ctx: { type: 'PROJECT', projectId: 'p1' }, key: '/projects/p1' },
    {
      name: 'PROJECT_TOPIC',
      ctx: { type: 'PROJECT_TOPIC', projectId: 'p1', topicId: 't1' },
      key: '/projects/p1/topics/t1',
    },
    {
      name: 'STORY',
      ctx: { type: 'STORY', projectId: 'p1', storyId: 's1' },
      key: '/projects/p1/stories/s1',
    },
    {
      name: 'FEATURE',
      ctx: { type: 'FEATURE', projectId: 'p1', storyId: 's1', featureId: 'f1' },
      key: '/projects/p1/stories/s1/features/f1',
    },
    {
      name: 'AGENT_RUN_STORY',
      ctx: { type: 'AGENT_RUN_STORY', projectId: 'p1', storyId: 's1', agentRunId: 'r1' },
      key: '/projects/p1/stories/s1/agents/r1',
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
      key: '/projects/p1/stories/s1/features/f1/agents/r1',
    },
    { name: 'GROUP', ctx: { type: 'GROUP', groupId: 'g1' }, key: '/groups/g1' },
    {
      name: 'GROUP_TOPIC',
      ctx: { type: 'GROUP_TOPIC', groupId: 'g1', topicId: 't1' },
      key: '/groups/g1/topics/t1',
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

  it('parses keys with or without a leading slash', () => {
    expect(getChatContext('/projects/p1')?.type).toBe('PROJECT')
    expect(getChatContext('projects/p1')?.type).toBe('PROJECT')
  })

  it('decodes a GENERAL chat with a numeric timestamp', () => {
    const ctx = getChatContext('general_1747687200000')
    expect(ctx?.type).toBe('GENERAL')
    expect(ctx?.timestamp).toBe('1747687200000')
  })
})
