import { Dispatch, SetStateAction } from 'react'
import { SystemPromptViewerModal } from 'thefactory-ui/web'
import UsageModal from '../UsageModal'
import ChatDynamicContextModal from '../ChatDynamicContextModal'
import type { ChatState } from '../../../contexts/chats/ChatsTypes'

export type ChatSidebarModalsProps = {
  isPromptModalOpen: boolean
  setIsPromptModalOpen: Dispatch<SetStateAction<boolean>>
  effectivePrompt: string
  isCostsModalOpen: boolean
  setIsCostsModalOpen: Dispatch<SetStateAction<boolean>>
  chatKey: string
  chat: ChatState | undefined
  isDynamicContextOpen: boolean
  setIsDynamicContextOpen: Dispatch<SetStateAction<boolean>>
}

export function ChatSidebarModals({
  isPromptModalOpen,
  setIsPromptModalOpen,
  effectivePrompt,
  isCostsModalOpen,
  setIsCostsModalOpen,
  chatKey,
  chat,
  isDynamicContextOpen,
  setIsDynamicContextOpen,
}: ChatSidebarModalsProps) {
  return (
    <>
      <SystemPromptViewerModal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        prompt={effectivePrompt}
        title="System Prompt"
      />

      <UsageModal
        isOpen={isCostsModalOpen}
        onClose={() => setIsCostsModalOpen(false)}
        messages={chat?.chat.messages || []}
        chatKey={chatKey}
      />

      <ChatDynamicContextModal
        isOpen={isDynamicContextOpen}
        onClose={() => setIsDynamicContextOpen(false)}
        dynamicContext={chat?.chat.dynamicContext}
      />
    </>
  )
}
