import React, { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/Select'
import { useChats } from '../hooks/useChats'
import { useLLMConfig } from '../contexts/LLMConfigContext'
import { useNavigator } from '../navigation/Navigator'
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar'
import { IconChat, IconDelete, IconPlus } from '../components/ui/Icons'
import { ChatInput, MessageList } from '../components/Chat'
import { playSendSound, tryResumeAudioContext } from '../../../assets/sounds'

export default function ChatView() {
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

  const handleSend = async (message: string, attachments: string[]) => {
    if (!activeConfig) return
    tryResumeAudioContext()
    playSendSound()
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
      <section className="flex-1 flex flex-col w-full h-[720px] bg-[var(--surface-base)] overflow-hidden">
        <header className="flex-shrink-0 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="m-0 text-[var(--text-primary)] text-[18px] leading-tight font-semibold truncate">
              Project Chat{' '}
              {currentChat ? `(${new Date(currentChat.updateDate).toLocaleString()})` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Select value={activeConfigId || ''} onValueChange={setActive}>
              <SelectTrigger className="ui-select w-[220px]">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {configs.map((cfg) => (
                  <SelectItem key={cfg.id} value={cfg.id!}>
                    {cfg.name} ({cfg.model})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => navigateView('Settings')}
              className="btn-secondary"
              aria-label="Open Settings"
            >
              Settings
            </button>
          </div>
        </header>

        {!isConfigured && (
          <div
            className="flex-shrink-0 mx-4 mt-3 rounded-md border border-[var(--border-default)] p-2 text-[13px] flex items-center justify-between gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent-primary) 10%, var(--surface-raised))',
              color: 'var(--text-primary)',
            }}
            role="status"
          >
            <span>
              LLM not configured. Set your API key in Settings to enable sending messages.
            </span>
            <button className="btn" onClick={() => navigateView('Settings')}>
              Configure
            </button>
          </div>
        )}

        <MessageList
          chatId={currentChat?.id}
          messages={currentChat?.messages || []}
          isThinking={isThinking}
        />

        <ChatInput onSend={handleSend} isThinking={isThinking} isConfigured={isConfigured} />
      </section>
    </CollapsibleSidebar>
  )
}
