import { useEffect } from 'react'
import { useApi } from '@core/contexts/ApiContext'
import { useWebNotifications } from 'thefactory-ui/web'
import { crossProjectNotification } from 'thefactory-ui/headless'

/**
 * Bridges WS broadcast events to OS-level notifications. Renders nothing.
 * The notify() helper itself decides whether to actually post (permission,
 * per-category toggle, document-visible suppression).
 */
export default function EventNotifier() {
  const { ws } = useApi()
  const { notify } = useWebNotifications()

  useEffect(
    () =>
      ws.on<{ chatKey?: string }>('chats:updated', () =>
        notify('chat', { title: 'New chat activity', tag: 'chat' }),
      ),
    [ws, notify],
  )

  useEffect(
    () =>
      ws.on('tests:result', () => notify('tests', { title: 'Test run finished', tag: 'tests' })),
    [ws, notify],
  )

  useEffect(
    () =>
      ws.on('git:status-changed', () => notify('git', { title: 'Git status changed', tag: 'git' })),
    [ws, notify],
  )

  // Cross-project feature requests: notify only on the meaningful transitions
  // (crossProjectNotification returns null for the noisy accepted/in_progress churn).
  useEffect(
    () =>
      ws.on<Parameters<typeof crossProjectNotification>[0]>('featureRequest:updated', (fr) => {
        const n = crossProjectNotification(fr)
        if (n) notify('cross-project', n)
      }),
    [ws, notify],
  )

  return null
}
