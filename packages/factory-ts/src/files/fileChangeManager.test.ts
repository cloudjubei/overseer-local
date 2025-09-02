import { describe, it, expect } from 'vitest'
import { FileChangeManager, type FileChange } from './fileChangeManager'

function makeChanges(): FileChange[] {
  return [
    {
      path: 'src/new.txt',
      status: 'added',
      newContent: 'hello\n',
    },
    {
      path: 'src/old.txt',
      status: 'deleted',
      oldContent: 'remove me\n',
    },
    {
      path: 'src/edit.txt',
      status: 'modified',
      oldContent: 'line1\nline2\n',
      newContent: 'line1\nLINE-2\n',
    },
  ]
}

describe('FileChangeManager diffs and state', () => {
  it('creates proposal with computed unified diffs and hunks', () => {
    const mgr = new FileChangeManager()
    const changes = makeChanges()
    const p = mgr.createProposal('/proj', changes, 'p1')

    expect(p.id).toBe('p1')
    expect(p.state).toBe('open')

    const files = mgr.listProposalFiles(p.id)
    expect(files).toHaveLength(3)

    const added = files.find(f => f.path === 'src/new.txt')!
    expect(added.status).toBe('added')
    expect(added.diff).toContain('+++ b')
    expect(added.hunks && added.hunks[0].lines.some(l => l.startsWith('+hello'))).toBe(true)

    const deleted = files.find(f => f.path === 'src/old.txt')!
    expect(deleted.status).toBe('deleted')
    expect(deleted.diff).toContain('--- a')
    expect(deleted.hunks && deleted.hunks[0].lines.some(l => l.startsWith('-remove me'))).toBe(true)

    const modified = files.find(f => f.path === 'src/edit.txt')!
    expect(modified.status).toBe('modified')
    expect(modified.hunks && modified.hunks[0].header.startsWith('@@ ')).toBe(true)
    expect(modified.hunks && modified.hunks[0].lines).toEqual([
      '-line2',
      '+LINE-2',
    ])

    const { files: diffFiles } = mgr.getProposalDiff(p.id)
    expect(diffFiles.map(f => f.path).sort()).toEqual(['src/edit.txt', 'src/new.txt', 'src/old.txt'])

    const summary = mgr.getSummary(p.id)
    expect(summary.counts).toEqual({ added: 1, modified: 1, deleted: 1, total: 3 })
    expect(summary.state).toBe('open')
  })

  it('accepts and rejects files updating proposal state', () => {
    const mgr = new FileChangeManager()
    const p = mgr.createProposal('/proj', makeChanges(), 'p2')

    mgr.acceptFiles(p.id, ['src/new.txt'])
    let summary = mgr.getSummary(p.id)
    expect(summary.accepted).toEqual(['src/new.txt'])
    expect(summary.state).toBe('partiallyAccepted')

    mgr.rejectFiles(p.id, ['src/old.txt', 'src/edit.txt'])
    summary = mgr.getSummary(p.id)
    expect(new Set(summary.rejected)).toEqual(new Set(['src/old.txt', 'src/edit.txt']))
    expect(summary.state).toBe('partiallyAccepted')

    // Accept remaining file -> all accepted
    mgr.acceptFiles(p.id, ['src/old.txt', 'src/edit.txt'])
    summary = mgr.getSummary(p.id)
    expect(summary.state).toBe('accepted')
  })

  it('errors when accepting/rejecting unknown file', () => {
    const mgr = new FileChangeManager()
    const p = mgr.createProposal('/proj', makeChanges(), 'p3')
    expect(() => mgr.acceptFiles(p.id, ['nope.txt'])).toThrow(/File not in proposal/)
    expect(() => mgr.rejectFiles(p.id, ['nope.txt'])).toThrow(/File not in proposal/)
  })

  it('discarding proposal marks all as rejected', () => {
    const mgr = new FileChangeManager()
    const p = mgr.createProposal('/proj', makeChanges(), 'p4')
    mgr.discardProposal(p.id)
    const summary = mgr.getSummary(p.id)
    expect(summary.state).toBe('rejected')
    expect(summary.rejected.sort()).toEqual(['src/edit.txt', 'src/new.txt', 'src/old.txt'].sort())
  })
})
