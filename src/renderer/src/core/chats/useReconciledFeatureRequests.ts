import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { listFeatureRequests, useApi, type FeatureRequest } from 'thefactory-ui/headless/api'

type Socket = ReturnType<typeof useApi>['ws']
type Requests = ReadonlyMap<string, FeatureRequest>
const EMPTY_REQUESTS: Requests = new Map()
const emptySnapshot = (): Requests => EMPTY_REQUESTS
const noSubscription = (): (() => void) => () => {}

type RequestFeed = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => Requests
  reconcileFirstOpen: () => void
  observeDecisionUpdate: (request: FeatureRequest) => void
}

function createFeed(ws: Socket): RequestFeed {
  const listeners = new Set<() => void>()
  let snapshot = EMPTY_REQUESTS
  let stop: (() => void) | undefined
  let refreshAfterOpen: (() => void) | undefined
  let applyLiveUpdate: ((request: FeatureRequest | null) => void) | undefined
  const lastDecisionUpdates = new Map<string, FeatureRequest>()

  function publish(requests: Requests): void {
    snapshot = requests
    for (const listener of listeners) listener()
  }

  function start(): () => void {
    const controller = new AbortController()
    const { signal } = controller
    let pendingUpdates: Map<string, FeatureRequest> | undefined

    async function refresh(): Promise<void> {
      const updates = new Map<string, FeatureRequest>()
      pendingUpdates = updates
      try {
        const { data } = await listFeatureRequests({ signal, throwOnError: true })
        if (signal.aborted || pendingUpdates !== updates) return

        const requests = new Map(data.map((request) => [request.id, request]))
        // A late list reply must not undo a newer update delivered during the read.
        for (const [id, update] of updates) {
          const listed = requests.get(id)
          if (!listed || update.updatedAt >= listed.updatedAt) requests.set(id, update)
        }
        publish(requests)
      } catch {
        // Keep the last known records on a transient error; retry on the next reconnect.
      } finally {
        if (pendingUpdates === updates) pendingUpdates = undefined
      }
    }

    applyLiveUpdate = (request) => {
      if (!request || typeof request.id !== 'string') return
      const current = snapshot.get(request.id)
      if (current === request || (current && current.updatedAt > request.updatedAt)) return
      pendingUpdates?.set(request.id, request)
      const requests = new Map(snapshot)
      requests.set(request.id, request)
      publish(requests)
    }
    const offUpdate = ws.on<FeatureRequest | null>('featureRequest:updated', applyLiveUpdate)
    const reconcile = (): void => {
      refreshAfterOpen = undefined
      void refresh()
    }
    // The initial seed may miss events before the first open, which onReconnect skips.
    refreshAfterOpen = ws.getState() === 'open' ? undefined : reconcile
    const offReconnect = ws.onReconnect(reconcile)
    void refresh()
    return () => {
      refreshAfterOpen = undefined
      controller.abort()
      offUpdate()
      offReconnect()
      snapshot = EMPTY_REQUESTS
      applyLiveUpdate = undefined
      lastDecisionUpdates.clear()
    }
  }

  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      if (listeners.size === 1) stop = start()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) {
          stop?.()
          stop = undefined
        }
      }
    },
    getSnapshot: (): Requests => snapshot,
    observeDecisionUpdate(request): void {
      // The chat and its dialog can observe the same write to the shared decision store.
      if (lastDecisionUpdates.get(request.id) === request) return
      lastDecisionUpdates.set(request.id, request)
      applyLiveUpdate?.(request)
    },
    reconcileFirstOpen(): void {
      if (ws.getState() === 'open') refreshAfterOpen?.()
    },
  }
}

const feeds = new WeakMap<Socket, RequestFeed>()

function feedFor(ws: Socket): RequestFeed {
  const existing = feeds.get(ws)
  if (existing) return existing
  const feed = createFeed(ws)
  feeds.set(ws, feed)
  return feed
}

/** One reconnect-aware desktop feed per API socket, shared by sidebar and request chats. */
export function useReconciledFeatureRequests(
  enabled = true,
  decisionRecord?: FeatureRequest,
): Requests {
  const { ws, wsState } = useApi()
  const feed = useMemo(() => (enabled ? feedFor(ws) : undefined), [enabled, ws])
  const requests = useSyncExternalStore(
    feed?.subscribe ?? noSubscription,
    feed?.getSnapshot ?? emptySnapshot,
    emptySnapshot,
  )
  useEffect(() => {
    if (wsState === 'open') feed?.reconcileFirstOpen()
  }, [feed, wsState])
  const previousDecision = useRef<{ feed?: RequestFeed; record?: FeatureRequest }>({})
  useEffect(() => {
    const previous = previousDecision.current
    previousDecision.current = { feed, record: decisionRecord }
    // The shared cache exposes stable records. Its initial value may predate a
    // recovery read; only a replacement for the same request is a live update.
    if (
      feed &&
      previous.feed === feed &&
      decisionRecord &&
      previous.record?.id === decisionRecord.id &&
      previous.record !== decisionRecord
    ) {
      feed.observeDecisionUpdate(decisionRecord)
    }
  }, [feed, decisionRecord])
  return requests
}
