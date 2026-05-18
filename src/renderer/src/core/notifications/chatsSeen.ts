/**
 * Per-chat "last seen" timestamps for unread-message badges. Stored in
 * `localStorage` because the backend doesn't track read-state per device:
 * marking a chat as read on the laptop shouldn't clear the unread dot on
 * the phone.
 *
 * Key: `getChatContextKey(ctx)` — the same canonical slug used in URLs.
 * Value: ISO timestamp of the most recent message the user has *seen*.
 *
 * Two-layer surface:
 *  - `readChatsSeen()` / `writeChatsSeen()` are imperative APIs that
 *    always hit `localStorage` directly. Tests, scripts, and one-off
 *    callers use these.
 *  - `useChatsSeen()` is the React hook layer backed by
 *    `useSyncExternalStore` + an in-memory snapshot. It integrates with
 *    React's scheduler and avoids the "Cannot update a component while
 *    rendering a different component" warnings that the previous
 *    per-hook `useState` + window-event pattern produced when the open
 *    chat's `markChatSeen` fired during render.
 */

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'thefactory.chatsSeen'
const EVT_KEY = 'thefactory.chatsSeen:changed'

export type ChatsSeenMap = Record<string, string>

export function readChatsSeen(): ChatsSeenMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as ChatsSeenMap
  } catch {
    return {}
  }
}

export function writeChatsSeen(next: ChatsSeenMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* localStorage unavailable or quota exceeded */
  }
  // Update the React-facing snapshot + notify subscribers so the hook
  // re-renders immediately (storage events don't fire in the originating
  // tab, so we can't rely on those alone for same-tab sync).
  snapshot = next
  // Schedule the notification as a microtask so we never fire `setState`
  // inside another component's render — even if the caller invoked
  // `writeChatsSeen` from inside one. React batches the resulting
  // re-renders into the next commit.
  queueMicrotask(notify)
  try {
    window.dispatchEvent(new CustomEvent(EVT_KEY))
  } catch {
    /* unavailable */
  }
}

export const CHATS_SEEN_EVENT = EVT_KEY

export function markSeen(map: ChatsSeenMap, key: string, at: string): ChatsSeenMap {
  if (map[key] === at) return map
  return { ...map, [key]: at }
}

/**
 * A chat is "unread" when it has messages and the most recent one is
 * newer than the stored last-seen timestamp. A chat that's never been
 * opened is unread iff it has any messages.
 */
export function isChatUnread(
  map: ChatsSeenMap,
  contextKey: string,
  latestMessageAt: string | undefined,
): boolean {
  if (!latestMessageAt) return false
  const seen = map[contextKey]
  if (!seen) return true
  return latestMessageAt > seen
}

// ──────────────────────────────────────────────────────────────────────────
// React hook layer
// ──────────────────────────────────────────────────────────────────────────

let snapshot: ChatsSeenMap = typeof window !== 'undefined' ? readChatsSeen() : {}
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

if (typeof window !== 'undefined') {
  // Cross-tab sync — another tab wrote to localStorage. Re-read storage
  // into the snapshot so React consumers pick up the change.
  window.addEventListener('storage', (ev) => {
    if (ev.key !== STORAGE_KEY) return
    snapshot = readChatsSeen()
    notify()
  })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): ChatsSeenMap {
  return snapshot
}

/**
 * React hook returning the current `ChatsSeenMap`. Use this instead of
 * `useState(readChatsSeen)` + a window-event listener — it integrates with
 * React's scheduler and avoids cross-component setState warnings.
 */
export function useChatsSeen(): ChatsSeenMap {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
