import { describe, expect, it } from 'vitest'
import { readDeepLink } from './deepLinkUtils'

describe('readDeepLink', () => {
  it.each([
    ['a project', 'overseer://projects/p1', { kind: 'project', projectId: 'p1' }],
    [
      'a story',
      'overseer://projects/p1/stories/s1',
      { kind: 'story', projectId: 'p1', storyId: 's1' },
    ],
    [
      'a feature',
      'overseer://projects/p1/stories/s1/features/f1',
      { kind: 'feature', projectId: 'p1', storyId: 's1', featureId: 'f1' },
    ],
    [
      'a run',
      'overseer://projects/p1/process-runs/r1',
      { kind: 'run', projectId: 'p1', runId: 'r1' },
    ],
    ['a note', 'overseer://projects/p1/notes/n1', { kind: 'note', projectId: 'p1', noteId: 'n1' }],
    [
      'a design screen',
      'overseer://projects/p1/design?screen=home',
      { kind: 'design', projectId: 'p1', screenId: 'home' },
    ],
    [
      'evidence at a moment',
      'overseer://projects/p1/evidence/e1?at=12.5',
      { kind: 'evidence', projectId: 'p1', evidenceId: 'e1', at: 12.5 },
    ],
    [
      'a group note',
      'overseer://groups/g1/notes/n1',
      { kind: 'groupNote', groupId: 'g1', noteId: 'n1' },
    ],
  ])('opens %s', (_label, url, link) => {
    expect(readDeepLink(url)).toEqual({ kind: 'open', link })
  })

  it('opens a link a browser handed over with a trailing slash', () => {
    expect(readDeepLink('overseer://projects/p1/stories/s1/')).toEqual({
      kind: 'open',
      link: { kind: 'story', projectId: 'p1', storyId: 's1' },
    })
  })

  it.each([
    ['an unknown path', 'overseer://nowhere/at/all'],
    ['a bare scheme', 'overseer://'],
    ['a broken escape', 'overseer://projects/%E0%A4%A/stories/s1'],
    ['another scheme', 'https://example.com/projects/p1'],
    ['an empty string', ''],
  ])('cannot read %s', (_label, url) => {
    expect(readDeepLink(url)).toEqual({ kind: 'unreadable', url })
  })

  it('cannot read a value that is no string', () => {
    expect(readDeepLink(42)).toEqual({ kind: 'unreadable', url: '42' })
  })
})
