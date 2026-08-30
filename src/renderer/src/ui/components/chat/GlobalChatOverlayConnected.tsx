import { GLOBAL_CHAT_TITLE, useGlobalChat } from 'thefactory-ui/headless'
import { GlobalChatOverlay } from 'thefactory-ui/web'
import ChatPanelBody from './ChatPanelBody'

/**
 * The app-level assistant chat. Mounted once at the root so the overlay
 * covers the entire app (sidebar included); the trigger lives in the
 * `Sidebar` footer, to the right of Settings.
 *
 * The overlay is only chrome: the conversation itself is the same
 * `ChatPanelBody` the docked chat sidebar renders.
 */
export default function GlobalChatOverlayConnected() {
  const { context, isOpen, close, reset, canReset, isResetting } = useGlobalChat()
  return (
    <GlobalChatOverlay
      isOpen={isOpen}
      onClose={close}
      onReset={canReset ? () => void reset() : undefined}
      isResetting={isResetting}
    >
      <ChatPanelBody
        context={context}
        chatContextTitle={GLOBAL_CHAT_TITLE}
        onCollapse={close}
        embedded
      />
    </GlobalChatOverlay>
  )
}
