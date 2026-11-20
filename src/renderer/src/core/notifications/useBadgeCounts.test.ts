import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { scopeBadgeIndicator, useBadgeCounts, type ScopeBadgeState } from './useBadgeCounts'

const { listRequests, reconnectHandlers, updateHandlers, connection } = vi.hoisted(() => ({
  listRequests: vi.fn(),
  connection: { state: 'open' as 'open' | 'connecting' },
  reconnectHandlers: new Set<() => void>(),
  updateHandlers: new Set<(data: unknown) => void>(),
}))

vi.mock('thefactory-ui/headless/api', async (importOriginal) => {
  const ws = {
    getState: () => connection.state,
    on: (_event: string, handler: (data: unknown) => void): (() => void) => {
      updateHandlers.add(handler)
      return () => {
        updateHandlers.delete(handler)
      }
    },
    onReconnect: (handler: () => void): (() => void) => {
      reconnectHandlers.add(handler)
      return () => {
        reconnectHandlers.delete(handler)
      }
    },
  }
  return {
    ...(await importOriginal<typeof import('thefactory-ui/headless/api')>()),
    listFeatureRequests: listRequests,
    useApi: () => ({ ws, wsState: connection.state }),
  }
})

vi.mock('thefactory-ui/headless', async (importOriginal) => ({
  ...(await importOriginal<typeof import('thefactory-ui/headless')>()),
  useActiveProject: () => ({ projectId: 'sender' }),
  useAppSettings: () => ({
    settings: { notifications: { badgesEnabled: {}, gitBadgeSubToggles: {} } },
  }),
  useAppUnreadCounts: () => () => 0,
  useChats: () => ({ chats: [] }),
  useExpiredSignIns: () => ({ byProject: new Map(), byGroup: new Map() }),
  useGit: () => ({ branches: [] }),
  useGroupSignOffCounts: () => new Map(),
  usePendingAsksByChat: () => new Map(),
  useProcessRunChatNews: () => new Map(),
  useProcessRuns: () => ({ runs: [] }),
  useProcessStopClock: () => 0,
  useProjectActivities: () => ({
    runningCount: 0,
    working: false,
    paused: false,
    liveForScope: () => 0,
    pausedForScope: () => 0,
    unseenForScope: () => 0,
  }),
  useTests: () => ({}),
}))

const request = {
  id: 'request',
  targetProjectId: 'receiver',
  status: 'in_progress',
  updatedAt: '2026-10-18T12:00:00.000Z',
}

const completed = { ...request, status: 'completed', updatedAt: '2026-10-18T12:01:00.000Z' }

function reconnect(): void {
  for (const handler of reconnectHandlers) handler()
}

function broadcast(update: typeof request): void {
  for (const handler of updateHandlers) handler(update)
}

describe('request running badges', () => {
  it('clears a request that finished before the socket first opened, without a broadcast', async () => {
    listRequests.mockReset()
    listRequests
      .mockResolvedValueOnce({ data: [request] })
      .mockResolvedValueOnce({ data: [completed] })
    connection.state = 'connecting'
    try {
      const { result, rerender } = renderHook(useBadgeCounts)
      const receiver = (): ScopeBadgeState => result.current.getProjectBadgeState('receiver')
      const folder = (): ScopeBadgeState =>
        result.current.getGroupBadgeState('group', ['sender', 'receiver'])
      await waitFor(() => expect(receiver().inFlightRequests).toBe(1))
      expect(folder().inFlightRequests).toBe(1)
      expect(listRequests).toHaveBeenCalledTimes(1)

      // WsClient does not call reconnect handlers on the first open.
      connection.state = 'open'
      rerender()
      await waitFor(() => expect(scopeBadgeIndicator(receiver())).toEqual({ kind: 'none' }))
      expect(scopeBadgeIndicator(folder())).toEqual({ kind: 'none' })
      expect(listRequests).toHaveBeenCalledTimes(2)
    } finally {
      connection.state = 'open'
    }
  })

  it('clears the receiving row and folder on reconnect without a terminal socket event', async () => {
    listRequests.mockReset()
    listRequests
      .mockResolvedValueOnce({ data: [request] })
      .mockResolvedValueOnce({ data: [completed] })
    const { result, unmount } = renderHook(useBadgeCounts)
    const receiver = (): ScopeBadgeState => result.current.getProjectBadgeState('receiver')
    const folder = (): ScopeBadgeState =>
      result.current.getGroupBadgeState('group', ['sender', 'receiver'])
    await waitFor(() => expect(receiver().inFlightRequests).toBe(1))
    expect(folder().inFlightRequests).toBe(1)

    act(reconnect)
    await waitFor(() => expect(scopeBadgeIndicator(receiver())).toEqual({ kind: 'none' }))
    expect(scopeBadgeIndicator(folder())).toEqual({ kind: 'none' })
    expect(listRequests).toHaveBeenCalledTimes(2)
    unmount()
    expect(reconnectHandlers.size).toBe(0)
    expect(updateHandlers.size).toBe(0)
  })

  it('does not restore a running badge when an older reconnect response follows a terminal event', async () => {
    listRequests.mockReset()
    let resolveRefresh!: (result: { data: Array<typeof request> }) => void
    const refresh = new Promise<{ data: Array<typeof request> }>((resolve) => {
      resolveRefresh = resolve
    })
    listRequests.mockResolvedValueOnce({ data: [request] }).mockReturnValueOnce(refresh)
    const { result } = renderHook(useBadgeCounts)
    const receiver = (): ScopeBadgeState => result.current.getProjectBadgeState('receiver')
    await waitFor(() => expect(receiver().inFlightRequests).toBe(1))

    act(reconnect)
    act(() => broadcast(completed))
    expect(scopeBadgeIndicator(receiver())).toEqual({ kind: 'none' })
    await act(async () => resolveRefresh({ data: [request] }))
    expect(scopeBadgeIndicator(receiver())).toEqual({ kind: 'none' })
  })

  it('shows request work on the receiving row and its rollup, then clears both when it settles', async () => {
    listRequests.mockReset()
    listRequests.mockResolvedValueOnce({ data: [request, { ...request, id: 'second' }] })
    const { result } = renderHook(useBadgeCounts)
    const project = (id: string): ScopeBadgeState => result.current.getProjectBadgeState(id)
    const group = (members: string[]): ScopeBadgeState =>
      result.current.getGroupBadgeState('group', members)
    const running = {
      kind: 'ink',
      badge: { parts: [], running: 'cross-project', rollup: true },
      title: 'a request is under way',
    }

    await waitFor(() => expect(project('receiver').inFlightRequests).toBe(2))
    expect(scopeBadgeIndicator(project('receiver'))).toEqual(running)
    expect(scopeBadgeIndicator(project('sender'))).toEqual({ kind: 'none' })
    expect(scopeBadgeIndicator(group(['sender', 'receiver']))).toEqual(running)
    expect(scopeBadgeIndicator(group([]))).toEqual({ kind: 'none' })
    expect(result.current.counts.activity).toBe(0)
    expect(result.current.counts.processesRunning).toBe(0)

    act(() => {
      broadcast(completed)
      broadcast({ ...completed, id: 'second' })
    })
    expect(scopeBadgeIndicator(project('receiver'))).toEqual({ kind: 'none' })
    expect(scopeBadgeIndicator(group(['sender', 'receiver']))).toEqual({ kind: 'none' })
  })
})
