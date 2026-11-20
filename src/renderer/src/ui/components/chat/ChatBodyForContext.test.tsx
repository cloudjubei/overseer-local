import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect, useMemo, useState } from 'react'
import { getChatContextKey } from '@core/chats/chatKey'
import { useRequestBadgeCounts } from '@core/notifications/useRequestBadgeCounts'
import type { ChatContext } from 'thefactory-ui/headless/api'
import type { ChatBodyProps } from 'thefactory-ui/web'
import ChatBodyForContext from './ChatBodyForContext'

const work = vi.hoisted(() => ({
  processStatus: 'running',
  requestStatus: 'in_progress',
  startAgain: vi.fn<() => Promise<void>>(),
  retryable: true,
  chatContextId: undefined as string | undefined,
  readTurn:
    vi.fn<
      (input: { query: { chatContextId: string } }) => Promise<{ data: { active: boolean } }>
    >(),
  readCliRuns: vi.fn(),
  listRequests: vi.fn(),
  cancelProcess: vi.fn(),
  send: vi.fn(),
  abort: vi.fn(),
}))
const context: ChatContext = {
  type: 'FEATURE_REQUEST',
  projectId: 'receiver',
  featureRequestId: 'request',
}
const contextKey = '/projects/receiver/feature-requests/request'
const lastMessage = 'Started work on the request.'
const linkedChatKey = '/projects/receiver/stories/linked-story'
const turnListeners = new Set<(event: { chatContextId: string; active: boolean }) => void>()
const reconnectListeners = new Set<() => void>()
const ws = {
  getState: () => 'open',
  on: (event: string, listener: (data: { chatContextId: string; active: boolean }) => void) => {
    if (event === 'completion:turn') turnListeners.add(listener)
    return () => turnListeners.delete(listener)
  },
  onReconnect: (listener: () => void) => {
    reconnectListeners.add(listener)
    return () => reconnectListeners.delete(listener)
  },
}

function emitTurn(chatContextId: string, active: boolean): void {
  for (const listener of turnListeners) listener({ chatContextId, active })
}

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@ui/hooks/useNavigateToResource', () => ({ useNavigateToResource: () => vi.fn() }))
vi.mock('@ui/hooks/useNavigateToGroupRun', () => ({ useNavigateToGroupRun: () => vi.fn() }))
vi.mock('@core/contexts/AuthContext', () => ({ useAuth: () => ({}) }))
vi.mock('@core/notifications/useBadgeCounts', () => ({ markChatSeen: vi.fn() }))
vi.mock('./ToolCall/renderers', () => ({ getToolHeaderPath: vi.fn(), renderToolCall: vi.fn() }))
vi.mock('./FeatureRequestFullModal', () => ({
  default: ({ requestId }: { requestId?: string }) =>
    requestId ? <div role="dialog">Full request {requestId}</div> : null,
}))
vi.mock('@ui/components/agents/RunModelChipConnected', () => ({ renderLaunchModelChip: vi.fn() }))
vi.mock('thefactory-ui/headless/api', () => ({
  abortChatCompletion: work.abort,
  getChatTurn: work.readTurn,
  listCliAgentRunSummaries: work.readCliRuns,
  listFeatureRequests: work.listRequests,
  useApi: () => ({ ws, wsState: 'open' }),
  extractErrorMessage: vi.fn(),
}))
vi.mock('thefactory-ui/headless', () => ({
  featureRequestChatContext: vi.fn(),
  useAgents: () => ({}),
  useChatComposer: () => ({ attachments: [], send: work.send, queue: {} }),
  useCrossProjectRequests: () => ({}),
  useOpenChat: () => ({ chat: { messages: [{ role: 'assistant', content: lastMessage }] } }),
  useChats: () => ({
    activeLLMConfig: {},
    getChatLiveState: () => ({ isSending: false }),
    getEffectiveChatSettings: () => ({}),
  }),
  chatClosure: () => ({ locked: false }),
  useCredentialCaptures: () => ({}),
  FEATURE_REQUEST_COMPOSER_HINT: '',
  FEATURE_REQUEST_OPEN_FULL_LABEL: 'Open the full request',
  canStartFeatureRequestAgain: () => work.retryable,
  hiddenFeatureRequestIntro: (messages: unknown) => messages,
  useIncomingFeatureRequest: () => {
    const [replyStatus, setReplyStatus] = useState<string>()
    const status = replyStatus ?? work.requestStatus
    const chatContextId = work.chatContextId
    const request = useMemo(
      () => ({
        id: 'request',
        status,
        updatedAt: '2026-10-18T12:00:00.000Z',
        targetProjectId: 'receiver',
        requestedBy: { fromProjectId: 'sender' },
        handling: {
          work: chatContextId
            ? { mode: 'chat', chatContextId }
            : { mode: 'process', processRunId: 'linked-process' },
        },
      }),
      [chatContextId, status],
    )
    return {
      request,
      startAgain: async () => {
        await work.startAgain()
        setReplyStatus('in_progress')
      },
    }
  },
  useFiles: () => ({ paths: [], files: [] }),
  // Model the shared hook's current contract: either source can set activity,
  // including a delayed snapshot that lands after a matching socket event.
  usePendingToolGrants: (chat: ChatContext) => {
    const chatContextId = getChatContextKey(chat)
    const [isRunActive, setActive] = useState(false)
    useEffect(() => {
      let mounted = true
      void work.readTurn({ query: { chatContextId } }).then(({ data }) => {
        if (mounted) setActive(data.active)
      })
      const off = ws.on('completion:turn', (event) => {
        if (event.chatContextId === chatContextId) setActive(event.active)
      })
      return () => {
        mounted = false
        off()
      }
    }, [chatContextId])
    return { isRunActive }
  },
  useTools: () => ({}),
  buildChatPromptVariables: vi.fn(),
  formatChatTitle: vi.fn(),
  useProjects: () => ({ projects: [] }),
  useProjectsGroups: () => ({}),
  useReferences: () => ({ canonicalize: (text: string) => text }),
  useStories: () => ({}),
  useProcessRun: (id?: string) => ({
    run: id === 'linked-process' ? { status: work.processStatus } : undefined,
    cancel: work.cancelProcess,
  }),
  useProcessRuns: () => ({ runs: [] }),
  useActiveProject: () => ({}),
  useFeatureRequestStart: (_request: unknown, decision: { startAgain: () => Promise<void> }) => ({
    onStartAgain: decision.startAgain,
  }),
  useProjectWorkLaunch: () => ({}),
}))

// Observe the desktop wrapper's contract with the shared chat body, including
// paths that can dispatch without going through the visible composer.
vi.mock('thefactory-ui/web', () => ({
  ChatBody: (props: ChatBodyProps) => (
    <>
      {props.messages.map((message) => (
        <p key={String(message.content)}>{String(message.content)}</p>
      ))}
      {props.onDeleteLastMessage && <button>Delete last message</button>}
      {props.onRestartTurn && <button>Restart turn</button>}
      {props.canSend && <button>Send</button>}
      {props.pendingQueue && <button>Send queued messages</button>}
      <button onClick={() => void props.onSend('Follow up', [])}>Invoke send callback</button>
      {props.inputOverride}
      {props.leadingContent}
    </>
  ),
  Button: ({ children, onClick, disabled }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  IncomingFeatureRequestCard: ({
    request,
    onStartAgain,
  }: {
    request: { status: string }
    onStartAgain: () => Promise<void>
  }) =>
    request.status === 'failed' && work.retryable ? (
      <button onClick={() => void onStartAgain()}>Start again</button>
    ) : null,
  StartWorkDialog: () => null,
  useReferenceRenderer: () => vi.fn(),
  useChatContextLastRead: () => ({}),
}))

function ReceiverRunningBadge(): React.JSX.Element | null {
  return useRequestBadgeCounts().has('receiver') ? <span>Receiver running</span> : null
}

describe('Feature-request chat read-only cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    work.listRequests.mockReset().mockResolvedValue({ data: [] })
    work.processStatus = 'running'
    work.requestStatus = 'in_progress'
    work.retryable = true
    work.chatContextId = undefined
    work.readTurn.mockReset().mockResolvedValue({ data: { active: false } })
    work.readCliRuns.mockReset().mockResolvedValue({ data: [] })
  })

  it('preserves the idle request transcript until its linked process stops', async () => {
    const { rerender } = render(<ChatBodyForContext context={context} />)

    expect(screen.getByText(lastMessage)).toBeVisible()
    expect(screen.getByText('Agent is running. Chat is read-only.')).toBeVisible()
    for (const name of ['Delete last message', 'Restart turn', 'Send', 'Send queued messages']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Invoke send callback' }))
    expect(work.send).not.toHaveBeenCalled()
    work.cancelProcess.mockImplementationOnce(async () => {
      work.processStatus = 'cancelled'
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }))
    })
    expect(work.cancelProcess).toHaveBeenCalledOnce()
    expect(work.abort).not.toHaveBeenCalled()

    rerender(<ChatBodyForContext context={context} />)
    expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete last message' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Restart turn' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Send' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Invoke send callback' }))
    expect(work.send).toHaveBeenCalledWith('Follow up', [])
  })

  it.each([contextKey, linkedChatKey])(
    'does not restore Cancel after an idle event for %s and an older active read',
    async (chatContextId) => {
      work.chatContextId = chatContextId
      let resolveActive!: (result: { data: { active: boolean } }) => void
      const staleRead = new Promise<{ data: { active: boolean } }>((resolve) => {
        resolveActive = resolve
      })
      work.readTurn.mockImplementation(({ query }) =>
        query.chatContextId === chatContextId
          ? staleRead
          : Promise.resolve({ data: { active: false } }),
      )
      render(<ChatBodyForContext context={context} />)
      expect(work.readTurn).toHaveBeenCalledWith(
        expect.objectContaining({ query: { chatContextId } }),
      )

      await act(async () => emitTurn(chatContextId, true))
      expect(screen.getByRole('button', { name: 'Cancel run' })).toBeVisible()
      await act(async () => emitTurn(chatContextId, false))
      expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()

      await act(async () => resolveActive({ data: { active: true } }))
      expect(screen.queryByRole('button', { name: 'Cancel run' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Send' })).toBeVisible()

      await act(async () => emitTurn(chatContextId, true))
      expect(screen.getByRole('button', { name: 'Cancel run' })).toBeVisible()
    },
  )

  it('keeps the same-chat launch read-only and cancels that chat', async () => {
    work.chatContextId = contextKey
    render(<ChatBodyForContext context={context} />)
    await act(async () => {})
    await act(async () => emitTurn(contextKey, true))

    expect(screen.queryByRole('button', { name: 'Restart turn' })).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel run' }))
    })
    expect(work.abort).toHaveBeenCalledWith({ body: { context }, throwOnError: true })
    expect(work.cancelProcess).not.toHaveBeenCalled()
  })

  it.each([
    ['completed', 'Feature request completed.', 'Review the outcome'],
    ['failed', 'Feature request failed.', 'Start again'],
    ['rejected', 'Feature request rejected.', 'Review the decision'],
  ])('shows the %s outcome and opens the full request', async (status, outcome, nextStep) => {
    const { rerender } = render(<ChatBodyForContext context={context} />)
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeVisible()

    // The request can finish before the linked run snapshot refreshes.
    work.requestStatus = status
    rerender(<ChatBodyForContext context={context} />)

    expect(screen.getByText(lastMessage)).toBeVisible()
    expect(screen.getByText(outcome)).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(outcome)
    expect(screen.getByRole('status')).toHaveTextContent(nextStep)
    for (const name of [
      'Cancel run',
      'Delete last message',
      'Restart turn',
      'Send',
      'Send queued messages',
    ]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Invoke send callback' }))
    expect(work.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Open the full request' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Full request request')
  })

  it.each([
    ['completed', 'newer', '2026-10-18T12:01:00.000Z'],
    ['failed', 'newer', '2026-10-18T12:01:00.000Z'],
    ['completed', 'equal', '2026-10-18T12:00:00.000Z'],
    ['failed', 'equal', '2026-10-18T12:00:00.000Z'],
  ])(
    'shows %s without a terminal broadcast when reconnect returns a timestamp that is %s',
    async (status, _timestampOrder, updatedAt) => {
      work.chatContextId = linkedChatKey
      let active = true
      work.readTurn.mockImplementation(async () => ({ data: { active } }))
      const running = {
        id: 'request',
        targetProjectId: 'receiver',
        requestedBy: { fromProjectId: 'sender' },
        status: 'in_progress',
        updatedAt: '2026-10-18T12:00:00.000Z',
        handling: { work: { mode: 'chat', chatContextId: linkedChatKey } },
      }
      work.listRequests.mockResolvedValue({ data: [running] })
      render(
        <>
          <ReceiverRunningBadge />
          <ChatBodyForContext context={context} />
        </>,
      )
      await screen.findByRole('button', { name: 'Cancel run' })
      expect(screen.getByText('Receiver running')).toBeVisible()
      expect(work.listRequests).toHaveBeenCalledTimes(1)
      const announcement = screen.getByRole('status')
      expect(announcement).toBeEmptyDOMElement()

      // The server finished while disconnected. The shared hook still returns in_progress.
      active = false
      work.listRequests.mockResolvedValue({
        data: [{ ...running, status, updatedAt }],
      })
      await act(async () => {
        for (const reconnect of reconnectListeners) reconnect()
      })

      await waitFor(() => expect(screen.getByText(`Feature request ${status}.`)).toBeVisible())
      expect(screen.queryByText('Receiver running')).not.toBeInTheDocument()
      expect(work.listRequests).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('status')).toBe(announcement)
      expect(screen.getByRole('button', { name: 'Open the full request' })).toBeVisible()
      for (const name of ['Cancel run', 'Send', 'Send queued messages']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      fireEvent.click(screen.getByRole('button', { name: 'Invoke send callback' }))
      expect(work.send).not.toHaveBeenCalled()
    },
  )

  it('shows a retry confirmed by an equal-timestamp HTTP reply without a socket update', async () => {
    work.requestStatus = 'failed'
    work.processStatus = 'failed'
    const failed = {
      id: 'request',
      status: 'failed',
      targetProjectId: 'receiver',
      requestedBy: { fromProjectId: 'sender' },
      updatedAt: '2026-10-18T12:00:00.000Z',
    }
    work.listRequests.mockResolvedValue({ data: [failed] })
    render(
      <>
        <ReceiverRunningBadge />
        <ChatBodyForContext context={context} />
      </>,
    )
    await act(async () => {})
    const announcement = screen.getByRole('status')
    expect(announcement).toHaveTextContent('Feature request failed.')

    work.startAgain.mockImplementationOnce(async () => {
      work.processStatus = 'running'
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    })

    expect(work.startAgain).toHaveBeenCalledOnce()
    expect(announcement).toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeVisible()
    expect(screen.getByText('Receiver running')).toBeVisible()

    // A subsequent recovery still wins the tie against the now-cached reply.
    work.listRequests.mockResolvedValue({ data: [{ ...failed, status: 'completed' }] })
    await act(async () => {
      for (const reconnect of reconnectListeners) reconnect()
    })
    expect(announcement).toHaveTextContent('Feature request completed.')
    expect(screen.queryByText('Receiver running')).not.toBeInTheDocument()
  })

  it('updates the same live region when an open request finishes, including after a retry', async () => {
    const { rerender } = render(<ChatBodyForContext context={context} />)
    await act(async () => {})

    const announcement = screen.getByRole('status')
    expect(announcement).toBeEmptyDOMElement()

    const updateStatus = (status: string): void => {
      work.requestStatus = status
      rerender(<ChatBodyForContext context={context} />)
      expect(screen.getByRole('status')).toBe(announcement)
    }

    updateStatus('failed')
    expect(announcement).toHaveTextContent('Feature request failed.')
    updateStatus('in_progress')
    expect(announcement).toBeEmptyDOMElement()
    updateStatus('failed')
    expect(announcement).toHaveTextContent('Feature request failed.')
  })

  it('uses theme token classes instead of inline styles for the finished banner', async () => {
    work.requestStatus = 'completed'
    work.processStatus = 'succeeded'
    render(<ChatBodyForContext context={context} />)
    await act(async () => {})

    const banner = screen.getByRole('button', { name: 'Open the full request' }).parentElement
    expect(banner).not.toHaveAttribute('style')
    expect(banner).toHaveClass('border-(--border-subtle)', 'bg-(--surface-muted)')
  })

  it('restores the running banner when failed work starts again', async () => {
    work.requestStatus = 'failed'
    work.processStatus = 'failed'
    const { rerender } = render(<ChatBodyForContext context={context} />)
    await act(async () => {})
    expect(screen.getByRole('status')).toHaveTextContent('Feature request failed.')

    work.requestStatus = 'in_progress'
    work.processStatus = 'running'
    rerender(<ChatBodyForContext context={context} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByText('Feature request failed.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeVisible()
  })

  it('does not suggest a retry when failed work cannot be restarted', async () => {
    work.requestStatus = 'failed'
    work.processStatus = 'failed'
    work.retryable = false
    render(<ChatBodyForContext context={context} />)
    await act(async () => {})
    expect(screen.getByText('Review what happened in the full request.')).toBeVisible()
    expect(screen.queryByText(/Start again/)).not.toBeInTheDocument()
  })
})
