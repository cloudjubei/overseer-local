import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import type { LocalDiffEntry } from 'thefactory-ui/headless'
import type { GitLocalFileEntry } from 'thefactory-ui/web'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import LocalChangesPane from './LocalChangesPane'

/**
 * Settled staged rows once the pane has rendered. Counts below are the props
 * the desktop pane forwards to the shared row. Painting of the old path and
 * the +N/−N pills belongs to that row.
 */
const EDITED_RENAME: LocalDiffEntry = {
  path: 'src/readers/current.ts',
  status: 'R',
  oldPath: 'src/readers/legacy.ts',
  additions: 4,
  deletions: 2,
}

const ZERO_RENAME: LocalDiffEntry = {
  path: 'src/video/benchmark/b.ts',
  status: 'R',
  oldPath: 'src/video/__fixtures__/a.ts',
  additions: 0,
  deletions: 0,
}

const RENAME_FROM_ONLY: LocalDiffEntry = {
  path: 'src/video/segment.ts',
  status: 'R',
  renameFrom: 'src/video/clip.ts',
}

const NO_COUNTS: LocalDiffEntry = {
  path: 'src/agent/AgentTools.ts',
  status: 'M',
}

type ForwardedFile = GitLocalFileEntry & {
  additions?: number
  deletions?: number
  oldPath?: string
  renameFrom?: string
}

const seen = vi.hoisted(() => ({ files: [] as ForwardedFile[] }))

const git = vi.hoisted(() => ({
  status: { untracked: [] as string[] },
  localDiff: {
    staged: [] as LocalDiffEntry[],
    unstaged: [] as LocalDiffEntry[],
    conflicts: [] as string[],
  },
  isLocalDiffLoading: false,
  loadLocalDiff: vi.fn(async () => undefined),
  stage: vi.fn(async () => undefined),
  unstage: vi.fn(async () => undefined),
  discardUnstaged: vi.fn(async () => undefined),
  discardStaged: vi.fn(async () => undefined),
  removeFiles: vi.fn(async () => undefined),
  applyPatch: vi.fn(async () => undefined),
  recoverTextDiff: vi.fn(async () => ({})),
  applyTextRecovery: vi.fn(async () => ({})),
}))

vi.mock('thefactory-ui/headless', async (importOriginal) => {
  const actual = await importOriginal<typeof import('thefactory-ui/headless')>()
  return {
    ...actual,
    useGit: () => git,
  }
})

vi.mock('thefactory-ui/web', async (importOriginal) => {
  const actual = await importOriginal<typeof import('thefactory-ui/web')>()
  return {
    ...actual,
    GitFileRow: (props: ComponentProps<typeof actual.GitFileRow>) => {
      seen.files.push(props.file)
      return <actual.GitFileRow {...props} />
    },
  }
})

function latest(path: string): ForwardedFile {
  const file = seen.files.filter((entry) => entry.path === path).at(-1)
  if (!file) throw new Error(`LocalChangesPane did not render ${path}`)
  return file
}

function renderPane(staged: LocalDiffEntry[]): void {
  git.localDiff = { staged, unstaged: [], conflicts: [] }
  render(<LocalChangesPane />)
}

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        return undefined
      }
      unobserve(): void {
        return undefined
      }
      disconnect(): void {
        return undefined
      }
    },
  )
})

beforeEach(() => {
  seen.files.length = 0
  git.localDiff = { staged: [], unstaged: [], conflicts: [] }
})

describe('LocalChangesPane entryToLocalFile', () => {
  it('forwards an explicit zero and does not invent missing counts', async () => {
    renderPane([ZERO_RENAME, RENAME_FROM_ONLY, NO_COUNTS])
    expect(await screen.findAllByRole('row')).toHaveLength(3)

    const zero = latest(ZERO_RENAME.path)
    expect(zero.oldPath).toBe('src/video/__fixtures__/a.ts')
    expect(zero).not.toHaveProperty('renameFrom')
    expect(zero.additions).toBe(0)
    expect(zero.deletions).toBe(0)

    const renamed = latest(RENAME_FROM_ONLY.path)
    expect(renamed.renameFrom).toBe('src/video/clip.ts')
    expect(renamed).not.toHaveProperty('oldPath')
    expect(renamed).not.toHaveProperty('additions')
    expect(renamed).not.toHaveProperty('deletions')

    const plain = latest(NO_COUNTS.path)
    expect(plain).not.toHaveProperty('additions')
    expect(plain).not.toHaveProperty('deletions')
    expect(plain).not.toHaveProperty('oldPath')
    expect(plain).not.toHaveProperty('renameFrom')
  })

  it('forwards a staged edited rename with no patch as oldPath, +4 and −2', async () => {
    renderPane([EDITED_RENAME])
    await screen.findByRole('row')

    const file = latest(EDITED_RENAME.path)
    expect(file.path).toBe('src/readers/current.ts')
    expect(file.patch).toBeUndefined()
    expect(file.oldPath).toBe('src/readers/legacy.ts')
    expect(file).not.toHaveProperty('renameFrom')
    expect(file.additions).toBe(4)
    expect(file.deletions).toBe(2)
  })
})
