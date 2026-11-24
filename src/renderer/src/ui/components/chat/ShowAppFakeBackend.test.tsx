import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RouterLeaveGuard, ToastProvider } from 'thefactory-ui/web'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import App from '@renderer/App'

const fixture = vi.hoisted(() => ({ url: '', token: 'fake-show-app-test' }))
vi.mock('@services/authService', () => ({
  authService: { get: async () => ({ baseUrl: fixture.url, token: fixture.token }) },
}))
vi.mock('@services/deepLinkService', () => ({ deepLinkService: { onOpen: () => () => {} } }))

let fake: ChildProcess
beforeAll(async () => {
  fake = spawn(process.execPath, ['fixtures/fake-backend.mjs'], {
    env: { ...process.env, PORT: '0', VITE_BEARER_TOKEN: fixture.token },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const lines = createInterface({ input: fake.stdout! })
  fixture.url = await new Promise<string>((resolve, reject) => {
    fake.once('error', reject)
    fake.once('exit', (code) => reject(new Error(`Fake backend exited (${code})`)))
    lines.on('line', (line) => {
      if (line.startsWith('Desktop fake backend on ')) resolve(line.split(' ').at(-1)!)
    })
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    },
  )
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false
  }
})

afterAll(async () => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
  if (fake?.pid && fake.exitCode === null && fake.signalCode === null) {
    fake.kill()
    await once(fake, 'exit')
  }
})

it('isolates Show app launched from the docked chat and restores the regular App on close', async () => {
  render(
    <MemoryRouter initialEntries={['/projects/thefactory-tools/app']}>
      <RouterLeaveGuard>
        <ToastProvider>
          <App />
        </ToastProvider>
      </RouterLeaveGuard>
    </MemoryRouter>,
  )
  await waitFor(() => expect(document.querySelectorAll('iframe')).toHaveLength(1))
  const regular = document.querySelector('iframe')!
  const post = (type: string, payload?: unknown): void => {
    fireEvent(
      window,
      new MessageEvent('message', {
        data: { type: `overseer:${type}`, payload },
        origin: new URL(regular.src).origin,
        source: regular.contentWindow,
      }),
    )
  }
  post('chat.requestSidebar')
  fireEvent.click(await screen.findByRole('button', { name: 'Open chat' }))
  post('app.dirty', { dirty: true })
  fireEvent.click(await screen.findByRole('button', { name: 'Show app' }))
  expect(await screen.findByText('Unsaved changes')).toBeVisible()
  expect(document.querySelector('iframe')).toBe(regular)
  expect(screen.queryByTitle('Project app')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Leave' }))
  const launched = await screen.findByTitle('Project app')
  expect(launched.closest('dialog[data-chat-app-snapshot]')).not.toBeNull()
  expect(Array.from(document.querySelectorAll('iframe'))).toEqual([launched])
  fireEvent.click(screen.getByRole('button', { name: 'Close app' }))
  await waitFor(() => expect(document.querySelectorAll('iframe')).toHaveLength(1))
  expect(document.querySelector('iframe')?.closest('dialog')).toBeNull()
  expect(screen.getByRole('button', { name: 'Show app' })).toBeVisible()
}, 15_000)

it('sends only the retained edited pick to the launching chat at the fake CLI turn boundary', async () => {
  // The list depends on a real HTTP read after the startup gate opens. Observe
  // that response before querying the UI, rather than polling through startup.
  let summariesLoaded!: () => void
  const summaries = new Promise<void>((resolve) => {
    summariesLoaded = resolve
  })
  const send = XMLHttpRequest.prototype.send
  const observeSummaries = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (
    this: XMLHttpRequest,
    ...args: Parameters<XMLHttpRequest['send']>
  ): void {
    this.addEventListener('load', () => {
      if (this.responseURL === `${fixture.url}/api/v1/chats/summaries` && this.status === 200) {
        summariesLoaded()
      }
    })
    send.apply(this, args)
  })
  const { unmount } = render(
    <MemoryRouter initialEntries={['/projects/thefactory-tools/chat']}>
      <RouterLeaveGuard>
        <ToastProvider>
          <App />
        </ToastProvider>
      </RouterLeaveGuard>
    </MemoryRouter>,
  )
  try {
    await summaries
    fireEvent.click(await screen.findByRole('button', { name: /App notes — first chat/ }))
    await screen.findByRole('heading', { name: 'App notes — first chat' })
    fireEvent.click(screen.getByRole('button', { name: 'Show app' }))
    const frame = (await screen.findByTitle('Project app')) as HTMLIFrameElement
    expect(new URL(frame.src).origin).toBe(fixture.url)
    const page = await fetch(frame.src)
    expect(page.ok).toBe(true)
    const pageDocument = new DOMParser().parseFromString(await page.text(), 'text/html')
    expect(pageDocument.title).toBe('Release board')
    const script = pageDocument.querySelector('script[src]')!
    const bridge = await fetch(new URL(script.getAttribute('src')!, frame.src))
    expect(bridge.ok).toBe(true)
    const bridgeSource = await bridge.text()
    const appWindow = frame.contentWindow!
    const appDocument = appWindow.document
    appDocument.replaceChildren(appDocument.importNode(pageDocument.documentElement, true))
    // jsdom does not load scripts in cross-origin iframes or expose the sender
    // on postMessage. Run the served bridge and relay messages with browser identities.
    const toHost = vi.fn((data: unknown, targetOrigin: string): void => {
      if (targetOrigin !== '*' && targetOrigin !== window.location.origin) return
      window.dispatchEvent(
        new MessageEvent('message', { source: appWindow, origin: fixture.url, data }),
      )
    })
    const parent = { postMessage: toHost }
    const bridgeEvents = new EventTarget()
    const toApp = vi.spyOn(appWindow, 'postMessage').mockImplementation((data) => {
      const event = new MessageEvent('message', { data })
      Object.defineProperty(event, 'source', { value: parent })
      bridgeEvents.dispatchEvent(event)
    })
    try {
      new Function('window', bridgeSource)({
        document: appDocument,
        parent,
        addEventListener: bridgeEvents.addEventListener.bind(bridgeEvents),
      })
      fireEvent.load(frame)
      expect(screen.getByText('Pick elements to comment in your chat')).toBeVisible()
      const status = appDocument.getElementById('release-status')!
      const owner = appDocument.getElementById('review-owner')!
      fireEvent.click(status, { shiftKey: true })
      expect(toHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'overseer:pick.selected',
          payload: expect.objectContaining({ additive: true }),
        }),
        '*',
      )
      expect(screen.getByRole('button', { name: 'Stop picking' })).toBeVisible()
      fireEvent.pointerOver(owner)
      fireEvent.click(owner)
      expect(toHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'overseer:pick.selected',
          payload: expect.objectContaining({ additive: false }),
        }),
        '*',
      )
      expect(screen.getByRole('button', { name: 'Pick element' })).toBeVisible()
      expect(screen.queryByText('Pick elements to comment in your chat')).not.toBeInTheDocument()
      toHost.mockClear()
      fireEvent.click(owner)
      expect(toHost).not.toHaveBeenCalled()
    } finally {
      toApp.mockRestore()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Close app' }))
    expect(screen.getAllByRole('textbox', { name: /Comment on app selection/ })).toHaveLength(2)
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment on app selection 1' }), {
      target: { value: 'Check this status' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove app selection 2' }))
    fireEvent.click(screen.getByRole('button', { name: /App notes — second chat/ }))
    expect(screen.getByRole('heading', { name: 'App notes — second chat' })).toBeVisible()
    expect(
      screen.queryByRole('textbox', { name: /Comment on app selection/ }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /App notes — first chat/ }))
    expect(screen.getByRole('textbox', { name: 'Comment on app selection 1' })).toHaveValue(
      'Check this status',
    )
    expect(screen.getByRole('textbox', { name: 'Message input' })).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(async () => {
      const turn = await fetch(`${fixture.url}/fixture/last-app-note-turn`, {
        headers: { Authorization: `Bearer ${fixture.token}` },
      })
      expect(await turn.json()).toEqual({
        context: {
          type: 'PROJECT_TOPIC',
          projectId: 'thefactory-tools',
          topicId: 'app-note-first',
        },
        noteOnly: true,
        appNotes: [
          {
            projectId: 'thefactory-tools',
            comment: 'Check this status',
            targets: [
              {
                kind: 'element',
                selector:
                  'html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > article:nth-of-type(1) > button:nth-of-type(1)',
              },
            ],
          },
        ],
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Stop response' })).not.toBeInTheDocument()
      expect(
        screen.queryByRole('textbox', { name: /Comment on app selection/ }),
      ).not.toBeInTheDocument()
    })
  } finally {
    observeSummaries.mockRestore()
    unmount()
  }
}, 15_000)
