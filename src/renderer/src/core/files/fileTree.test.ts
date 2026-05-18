import { describe, expect, it } from 'vitest'
import { buildFileTree } from './fileTree'

describe('buildFileTree', () => {
  it('returns an empty array for no paths', () => {
    expect(buildFileTree([])).toEqual([])
  })

  it('groups files under their directories', () => {
    const tree = buildFileTree(['src/index.ts', 'src/api/client.ts', 'package.json'])
    expect(tree).toEqual([
      {
        kind: 'dir',
        path: 'src',
        name: 'src',
        children: [
          {
            kind: 'dir',
            path: 'src/api',
            name: 'api',
            children: [{ kind: 'file', path: 'src/api/client.ts', name: 'client.ts' }],
          },
          { kind: 'file', path: 'src/index.ts', name: 'index.ts' },
        ],
      },
      { kind: 'file', path: 'package.json', name: 'package.json' },
    ])
  })

  it('sorts directories before files and each group alphabetically', () => {
    const tree = buildFileTree(['z.md', 'dir/a.ts', 'a.txt', 'dir/b.ts'])
    expect(tree.map((n) => n.name)).toEqual(['dir', 'a.txt', 'z.md'])
    const dir = tree[0]
    if (dir.kind !== 'dir') throw new Error('expected dir')
    expect(dir.children.map((c) => c.name)).toEqual(['a.ts', 'b.ts'])
  })

  it('strips leading slashes from incoming paths', () => {
    const tree = buildFileTree(['/src/x.ts'])
    expect(tree).toEqual([
      {
        kind: 'dir',
        path: 'src',
        name: 'src',
        children: [{ kind: 'file', path: 'src/x.ts', name: 'x.ts' }],
      },
    ])
  })

  it('ignores empty path entries', () => {
    expect(buildFileTree(['', 'a.ts'])).toEqual([{ kind: 'file', path: 'a.ts', name: 'a.ts' }])
  })
})
