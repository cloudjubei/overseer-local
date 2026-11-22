import type { ResourceLink } from 'thefactory-tools/types'

/** What to do with an `overseer://` link opened outside the app. */
export type DeepLinkOutcome =
  | { kind: 'open'; link: ResourceLink }
  | { kind: 'unreadable'; url: string }
