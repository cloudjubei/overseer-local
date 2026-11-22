import { parseResourceLink } from 'thefactory-tools/utils'
import type { ResourceLink } from 'thefactory-tools/types'
import type { DeepLinkOutcome } from './deepLinkTypes'

function parseOrUndefined(text: string): ResourceLink | undefined {
  try {
    return parseResourceLink(text)
  } catch {
    return undefined
  }
}

/** Reads an `overseer://` link opened outside the app into what the app opens. */
export function readDeepLink(url: unknown): DeepLinkOutcome {
  const text = String(url)
  const link = parseOrUndefined(text)
  return link ? { kind: 'open', link } : { kind: 'unreadable', url: text }
}
