import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import ChatAppSnapshotDialog from './ChatAppSnapshotDialog'

const app = vi.hoisted(() => ({ url: 'https://app.example.test/index.html', key: 0 }))
vi.mock('thefactory-ui/headless', async (original) => ({
  ...(await original<typeof import('thefactory-ui/headless')>()),
  useProjectAppView: () => ({ ...app, error: null }),
  useProjectDataBridge: () => () => undefined,
  useScreenshotAnnotation: () => null,
}))
vi.mock('thefactory-ui/headless/api', () => ({ useApi: () => ({}) }))

beforeEach(() => {
  app.key = 0
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false
  }
})

it('starts in pick mode and accepts multiple picks only from the current app frame', () => {
  const addNote = vi.fn()
  const props = {
    context: { type: 'PROJECT' as const, projectId: 'project' },
    projectId: 'project',
    addNote,
    onClose: vi.fn(),
    noteIds: () => [],
  }
  const { rerender } = render(<ChatAppSnapshotDialog {...props} />)
  const frame = (): Window => (screen.getByTitle('Project app') as HTMLIFrameElement).contentWindow!
  const first = frame()
  const origin = new URL(app.url).origin
  const pick = (selector: string, source = first, from = origin, additive = true): void => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source,
          origin: from,
          data: {
            type: 'overseer:pick.selected',
            payload: { selector, outerHtml: '<p>Example</p>', additive },
          },
        }),
      )
    })
  }
  expect(screen.getByRole('button', { name: 'Stop picking' })).toBeVisible()
  pick('#first', window, origin, false)
  pick('#first', first, 'https://other.example.test', false)
  pick(' ')
  expect(addNote).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Stop picking' })).toBeVisible()

  // The bridge exits on a plain pick even when the host rejects its note data.
  pick(' ', first, origin, false)
  expect(addNote).not.toHaveBeenCalled()
  expect(screen.queryByText('Pick elements to comment in your chat')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Pick element' }))
  pick('#first')
  expect(screen.getByRole('button', { name: 'Stop picking' })).toBeVisible()
  pick('#second', first, origin, false)
  expect(screen.getByRole('button', { name: 'Pick element' })).toBeVisible()
  pick('#after-exit')
  expect(addNote.mock.calls.map(([note]) => note.targets[0].selector)).toEqual([
    '#first',
    '#second',
  ])
  expect(addNote.mock.calls[0][0].id).not.toBe(addNote.mock.calls[1][0].id)
  expect(props.onClose).not.toHaveBeenCalled()

  app.key++
  rerender(<ChatAppSnapshotDialog {...props} />)
  expect(screen.getByRole('button', { name: 'Pick element' })).toBeVisible()
  pick('#inactive', frame())
  fireEvent.click(screen.getByRole('button', { name: 'Pick element' }))
  pick('#stale')
  expect(addNote).toHaveBeenCalledTimes(2)
  pick('#current', frame())
  expect(addNote).toHaveBeenCalledTimes(3)
})
