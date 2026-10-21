import type { ReactNode } from 'react'
import type { RenderToolPreviewArgs } from 'thefactory-ui/web'
import { getToolHeaderPath } from 'thefactory-ui/headless'
import ConnectedToolPreview from './ConnectedToolPreview'
import type { ToolCall } from '../types'

export { getToolHeaderPath }

/**
 * Web wrapper around the shared `renderToolPreview` registry in
 * `thefactory-ui`. Injects host-specific lookups (stories / features /
 * projects) + story-card / feature-card renderers so the hover preview
 * renders identically to desktop.
 *
 * Exposed as the `renderToolCall` callback that `MessageList` forwards to
 * every `ToolCallCard`.
 */
export function renderToolCall(props: {
  toolCall: ToolCall
  result?: unknown
  resultType?: unknown
}): ReactNode {
  // Hook into web's contexts via a tiny inner component — `renderToolCall`
  // itself is invoked from MessageRow (a component) so it's a render-prop,
  // which lets us call `useStories()` / `useActiveProject()` legally.
  return <ConnectedToolPreview {...(props as RenderToolPreviewArgs)} />
}
