import React, { Dispatch, SetStateAction } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
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
      <Modal
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
        title="System Prompt"
      >
        <div className="p-4 bg-[var(--surface-base)] text-sm text-[var(--text-secondary)] max-h-[70vh] overflow-auto">
          <pre className="whitespace-pre-wrap font-sans">{effectivePrompt}</pre>
        </div>
      </Modal>

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
