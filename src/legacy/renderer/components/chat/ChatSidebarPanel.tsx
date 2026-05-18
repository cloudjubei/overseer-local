import ChatSidebar from './ChatSidebar'
import type { ChatContext } from 'thefactory-tools'
import { ChatSidebarPanel as ChatSidebarPanelBase } from 'thefactory-ui/web'

export default function ChatSidebarPanel({
  isOpen = true,
  context,
  chatContextTitle,
  initialWidth = 380,
  onWidthChange,
}: {
  isOpen?: boolean
  context: ChatContext
  chatContextTitle: string
  initialWidth?: number
  onWidthChange?: (width: number, isFinal: boolean) => void
}) {
  return (
    <ChatSidebarPanelBase
      isOpen={isOpen}
      initialWidth={initialWidth}
      onWidthChange={onWidthChange}
      collapsedTitle={chatContextTitle}
      collapsedAriaLabel="Open chat"
      expandedAriaLabel="Chat sidebar"
    >
      {({ setCollapsed }) => (
        <ChatSidebar
          context={context}
          chatContextTitle={chatContextTitle}
          isCollapsible
          showLeftBorder={false}
          onCollapse={() => setCollapsed(true)}
        />
      )}
    </ChatSidebarPanelBase>
  )
}
