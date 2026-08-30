import type { ChatContext } from 'thefactory-ui/headless/api'
import { ChatSidebarPanel as ChatSidebarPanelBase } from 'thefactory-ui/web'
import ChatPanelBody from './ChatPanelBody'

export type ChatSidebarPanelConnectedProps = {
  context: ChatContext
  chatContextTitle: string
  initialWidth?: number
  onWidthChange?: (width: number, isFinal: boolean) => void
  /** Controlled collapsed state (e.g. so an app's "Discuss" action can expand it). */
  collapsed?: boolean
  onCollapsedChange?: (next: boolean) => void
  /** Render attached to a dialog (rounded outer corners + single collapsed button). */
  attached?: boolean
}

/**
 * Collapsible chat sidebar. Renders the same fully-wired `ChatPanelBody` as
 * the global chat overlay — this wrapper only adds the resize + collapse
 * chrome from `ChatSidebarPanelBase`.
 */
export default function ChatSidebarPanelConnected({
  context,
  chatContextTitle,
  initialWidth = 380,
  onWidthChange,
  collapsed,
  onCollapsedChange,
  attached,
}: ChatSidebarPanelConnectedProps) {
  return (
    <ChatSidebarPanelBase
      initialWidth={initialWidth}
      onWidthChange={onWidthChange}
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      collapsedTitle={chatContextTitle}
      collapsedAriaLabel="Open chat"
      expandedAriaLabel="Chat sidebar"
      attached={attached}
    >
      {({ setCollapsed }) => (
        <ChatPanelBody
          context={context}
          chatContextTitle={chatContextTitle}
          onCollapse={() => setCollapsed(true)}
        />
      )}
    </ChatSidebarPanelBase>
  )
}
