import type { ChatContext } from 'thefactory-ui/headless/api'
import { getChatContextKey } from './chatKey'

/** The Assistant page, or one of its conversations by its URL-encoded chat key. */
export function assistantPath(context?: ChatContext): string {
  return context ? `/assistant/${encodeURIComponent(getChatContextKey(context))}` : '/assistant'
}
