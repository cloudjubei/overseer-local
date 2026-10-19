import { useCallback, useEffect } from 'react'
import { useApi } from '@core/contexts/ApiContext'
import { useWebNotifications } from 'thefactory-ui/web'
import {
  crossProjectNotification,
  storageWarningNotification,
  useChatNewsNotifier,
} from 'thefactory-ui/headless'

/**
 * Bridges WS broadcast events — news for the person reaching a chat, or an
 * ask waiting on them, at each chat's notification level — to OS-level
 * notifications. A process run's chats are left to the run's badges.
 * Renders nothing.
 * The notify() helper itself decides whether to actually post (permission,
 * per-category toggle, document-visible suppression).
 */
export default function EventNotifier(): null {
  const { ws } = useApi()
  const { notify } = useWebNotifications()

  useChatNewsNotifier(useCallback((n) => notify('chat', n), [notify]))

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

  useEffect(
    () =>
      ws.on<Parameters<typeof storageWarningNotification>[0]>('storage:usage-warning', (warning) =>
        notify('storage', storageWarningNotification(warning)),
      ),
    [ws, notify],
  )

  return null
}
