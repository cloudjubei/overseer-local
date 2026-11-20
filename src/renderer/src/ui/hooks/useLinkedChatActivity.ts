import { useEffect, useState } from 'react'
import { getChatTurn, listCliAgentRunSummaries, useApi } from 'thefactory-ui/headless/api'

const CLI_ACTIVITY_EVENTS = new Set([
  'started',
  'statusChanged',
  'finished',
  'error',
  'actionRequest',
])

/** Activity for the chat recorded on a feature request, independent of its pending approvals. */
export function useLinkedChatActivity(chatContextId: string | undefined): boolean {
  const { ws } = useApi()
  const [apiTurn, setApiTurn] = useState<{ chatContextId: string; active: boolean }>()
  const [cliRun, setCliRun] = useState<{ chatContextId: string; active: boolean }>()

  useEffect(() => {
    if (!chatContextId) return
    const controller = new AbortController()
    const { signal } = controller
    let turnRevision = 0
    let cliRevision = 0

    const readTurn = async (): Promise<void> => {
      const revision = ++turnRevision
      try {
        const { data } = await getChatTurn({ query: { chatContextId }, signal, throwOnError: true })
        if (!signal.aborted && revision === turnRevision) {
          setApiTurn({ chatContextId, active: data.active })
        }
      } catch {
        // Keep the last known state while the backend is unavailable.
      }
    }
    const readCli = async (): Promise<void> => {
      const revision = ++cliRevision
      try {
        const { data } = await listCliAgentRunSummaries({
          query: { chatContextId, status: 'running' },
          signal,
          throwOnError: true,
        })
        if (!signal.aborted && revision === cliRevision) {
          setCliRun({
            chatContextId,
            active: data.some(
              (run) => run.chatContextId === chatContextId && !run.hiddenContextCheckpoint,
            ),
          })
        }
      } catch {
        // Keep the last known state while the backend is unavailable.
      }
    }
    const refresh = (): void => {
      void readTurn()
      void readCli()
    }
    const offTurn = ws.on<{ chatContextId?: string; active?: boolean } | null>(
      'completion:turn',
      (event) => {
        if (event?.chatContextId !== chatContextId || typeof event.active !== 'boolean') return
        // A matching event is newer than any read already in flight.
        turnRevision++
        setApiTurn({ chatContextId, active: event.active })
      },
    )
    const offCli = ws.on<{ chatContextId?: string; type?: string } | null>(
      'cli:run-update',
      (event) => {
        if (
          event?.type &&
          CLI_ACTIVITY_EVENTS.has(event.type) &&
          (typeof event.chatContextId !== 'string' || event.chatContextId === chatContextId)
        ) {
          void readCli()
        }
      },
    )
    const offReconnect = ws.onReconnect(refresh)
    refresh()
    return () => {
      controller.abort()
      offTurn()
      offCli()
      offReconnect()
    }
  }, [chatContextId, ws])

  return (
    (apiTurn?.chatContextId === chatContextId && apiTurn?.active === true) ||
    (cliRun?.chatContextId === chatContextId && cliRun?.active === true)
  )
}
