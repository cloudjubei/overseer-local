import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { ChatHeader, ChatSidebarPanel as ChatSidebarPanelBase } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import ChatBodyForContext from './ChatBodyForContext'
import { ChatDynamicContextModal } from 'thefactory-ui/web'
import ChatSettingsDropdownConnected from './ChatSettingsDropdownConnected'
import { SystemPromptViewerConnected } from 'thefactory-ui/web'
import { ContextInfoButton } from 'thefactory-ui/web'
import ModelChip from '@ui/components/agents/ModelChip'
import { UsageModalConnected as UsageModal } from 'thefactory-ui/web'
import { useChats } from 'thefactory-ui/headless'

export type ChatSidebarPanelProps = {
  context: ChatContext
  chatContextTitle: string
  initialWidth?: number
  onWidthChange?: (width: number, isFinal: boolean) => void
}

/**
 * Collapsible chat sidebar. When expanded it renders the same `ChatBody`
 * as the full chat screen — there is no stub anymore. The header still
 * offers a shortcut to open the chat in its own route.
 *
 * Self-contained on desktop: web factors this body out into a `ChatPanelBody`
 * so its small-screen `ChatBottomSheet` can reuse it, but desktop is
 * big-screen only and has no bottom sheet, so the split would be a
 * single-consumer indirection here.
 */
export default function ChatSidebarPanel({
  context,
  chatContextTitle,
  initialWidth = 380,
  onWidthChange,
}: ChatSidebarPanelProps) {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const { getChat, clearChat, deleteChat } = useChats()

  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [dynamicContextOpen, setDynamicContextOpen] = useState(false)

  const openFullView = () => {
    const projectId = context.projectId ?? urlProjectId
    if (!projectId) return
    const key = getChatContextKey(context)
    navigate(`/projects/${projectId}/chat/${encodeURIComponent(key)}`)
  }

  const chat = getChat(context)
  const messages = chat?.messages ?? []
  const totalCost = messages.reduce((sum, m) => sum + (m.usage?.cost ?? 0), 0)
  const isAgentRunChat = context.type === 'AGENT_RUN_STORY' || context.type === 'AGENT_RUN_FEATURE'
  const isRunningAgent = isAgentRunChat && (chat?.state === 'created' || chat?.state === 'running')

  return (
    <ChatSidebarPanelBase
      initialWidth={initialWidth}
      onWidthChange={onWidthChange}
      collapsedTitle={chatContextTitle}
      collapsedAriaLabel="Open chat"
      expandedAriaLabel="Chat sidebar"
    >
      {({ setCollapsed }) => (
        <div className="relative h-full flex flex-col bg-(--surface-base)">
          <ChatBodyForContext
            context={context}
            header={
              <ChatHeader
                isCollapsible
                onCollapse={() => setCollapsed(true)}
                onMaximize={openFullView}
                totalCostUSD={totalCost}
                contextInfoSlot={
                  <ContextInfoButton
                    storyId={context.storyId}
                    featureId={context.featureId}
                    label={chatContextTitle}
                  />
                }
                onOpenPrompt={() => setPromptOpen(true)}
                onOpenCosts={() => setUsageOpen(true)}
                onOpenDynamicContext={() => setDynamicContextOpen(true)}
                onRefresh={() => {
                  if (window.confirm('Clear all messages in this chat? This cannot be undone.')) {
                    void clearChat(context)
                  }
                }}
                onOpenSettings={() => setSettingsOpen((v) => !v)}
                settingsBtnRef={settingsBtnRef}
                isSettingsOpen={settingsOpen}
                isRunningAgent={isRunningAgent}
                modelChip={<ModelChip editable className="border-blue-500" mode="chat" />}
                settingsDropdown={
                  <ChatSettingsDropdownConnected
                    context={context}
                    isOpen={settingsOpen}
                    onClose={() => setSettingsOpen(false)}
                    settingsBtnRef={settingsBtnRef}
                    onDeleteChat={async () => {
                      if (context.type === 'PROJECT') {
                        window.alert('The General chat cannot be deleted.')
                        return
                      }
                      const confirmed = window.confirm(
                        'Delete this chat? This action cannot be undone.',
                      )
                      if (!confirmed) return
                      setSettingsOpen(false)
                      try {
                        await deleteChat(context)
                      } catch (e) {
                        console.error('Failed to delete chat', e)
                        window.alert('Failed to delete chat. Please try again.')
                      }
                    }}
                  />
                }
              />
            }
          />

          <UsageModal
            isOpen={usageOpen}
            onClose={() => setUsageOpen(false)}
            messages={messages}
            chatKey={getChatContextKey(context)}
          />

          <SystemPromptViewerConnected
            isOpen={promptOpen}
            onClose={() => setPromptOpen(false)}
            context={context}
          />

          <ChatDynamicContextModal
            isOpen={dynamicContextOpen}
            onClose={() => setDynamicContextOpen(false)}
            context={context}
          />
        </div>
      )}
    </ChatSidebarPanelBase>
  )
}
