/**
 * Client-side tree construction from a flat list of paths.
 *
 * The backend returns files as a flat `string[]` (e.g. `src/api/client.ts`).
 * This module turns that into a hierarchical structure the tree view can
 * render. Directories are inferred from the prefix segments.
 */

export type FileNode = { kind: 'file'; path: string; name: string }
export type DirNode = { kind: 'dir'; path: string; name: string; children: TreeNode[] }
export type TreeNode = FileNode | DirNode

/** Sort files after directories, each group alphabetically by name. */
function sortChildren(children: TreeNode[]): TreeNode[] {
  return [...children].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function buildFileTree(paths: ReadonlyArray<string>): TreeNode[] {
  const root: DirNode = { kind: 'dir', path: '', name: '', children: [] }
  // Index of directory nodes by their full path so we can attach children
  // without walking the tree from the root on every insert.
  const dirs = new Map<string, DirNode>([['', root]])

  for (const raw of paths) {
    const path = raw.replace(/^\/+/, '')
    if (path.length === 0) continue

    const segments = path.split('/')
    let parent = root
    for (let i = 0; i < segments.length - 1; i++) {
      const dirPath = segments.slice(0, i + 1).join('/')
      let dir = dirs.get(dirPath)
      if (!dir) {
        dir = { kind: 'dir', path: dirPath, name: segments[i], children: [] }
        dirs.set(dirPath, dir)
        parent.children.push(dir)
      }
      parent = dir
    }

    const name = segments[segments.length - 1]
    parent.children.push({ kind: 'file', path, name })
  }

  const recurseSort = (node: DirNode): DirNode => ({
    ...node,
    children: sortChildren(node.children).map((c) => (c.kind === 'dir' ? recurseSort(c) : c)),
  })

  return recurseSort(root).children
}
