import React, { useMemo } from 'react'
import { useContextualChat } from '../../hooks/useContextualChat'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import ChatSidebar from './ChatSidebar'

interface ContextualChatSidebarProps {
  contextId: string
  chatContextTitle: string
}

export default function ContextualChatSidebar({ contextId, chatContextTitle }: ContextualChatSidebarProps) {
  const {
    currentChatId,
    chatsById,
    sendMessage,
    isThinking,
  } = useContextualChat(contextId)
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const currentChat = useMemo(
    () => (currentChatId ? chatsById[currentChatId] : undefined),
    [currentChatId, chatsById],
  )

  const handleSendMessage = async (message: string, attachments: string[]) => {
    if (!activeConfig) return
    await sendMessage(message, activeConfig, attachments)
  }

  return (
      <ChatSidebar
        chatContextTitle={chatContextTitle}
        currentChat={currentChat}
        isThinking={isThinking}
        isConfigured={isConfigured}
        onSend={handleSendMessage}
        configs={configs}
        activeConfigId={activeConfigId}
        onConfigChange={setActive}
        onConfigure={() => navigateView('Settings')}
        activeConfig={activeConfig}
      />
  )
}
