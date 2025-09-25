import React, { useMemo } from 'react'
import { ChatsProvider, useChats } from '../contexts/ChatsContext'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useNavigator } from '../navigation/Navigator'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import { IconChat, IconDelete, IconPlus } from '../components/ui/Icons'
import { ChatSidebar } from '../components/Chat'

function ChatScreenInner() {
  const {
    currentChatId,
    setCurrentChatId,
    chatsById,
    createChat,
    deleteChat,
    sendMessage,
    isThinking,
  } = useChats()
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const currentChat = useMemo(
    () => (currentChatId ? chatsById[currentChatId] : undefined),
    [currentChatId, chatsById],
  )

  const chatHistories = useMemo(
    () =>
      Object.values(chatsById).sort(
        (a, b) => new Date(a.updateDate).getTime() - new Date(b.updateDate).getTime(),
      ),
    [chatsById],
  )

  const handleSendMessage = async (message: string, attachments: string[]) => {
    if (!activeConfig) return
    await sendMessage(message, activeConfig, attachments)
  }

  const chatItems = useMemo(
    () =>
      chatHistories.map((chat) => ({
        id: chat.id,
        label: `Chat ${new Date(chat.creationDate)}`,
        icon: <IconChat className="w-4 h-4" />,
        accent: 'gray',
        action: (
          <button
            onClick={(e) => {
              e.stopPropagation()
              deleteChat(chat.id)
            }}
            aria-label="Delete chat"
            title="Delete chat"
          >
            <IconDelete className="w-4 h-4" />
          </button>
        ),
      })),
    [chatHistories, deleteChat],
  )

  return (
    <CollapsibleSidebar
      items={chatItems}
      activeId={currentChatId || ''}
      onSelect={setCurrentChatId}
      storageKey="chat-sidebar-collapsed"
      headerTitle="History"
      headerSubtitle=""
      headerAction={
        <button
          className="btn"
          onClick={createChat}
          aria-label="Create new chat"
          title="Create new chat"
        >
          <span className="inline-flex items-center gap-1">
            <IconPlus className="w-4 h-4" />
            <span>New</span>
          </span>
        </button>
      }
      emptyMessage="No chats yet"
    >
      <ChatSidebar
        chatContextTitle="Project Chat"
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
    </CollapsibleSidebar>
  )
}

export default function ChatView() {
  return (
    <ChatsProvider>
      <ChatScreenInner />
    </ChatsProvider>
  )
}
