import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { ChatHeader } from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import { useChats } from 'thefactory-ui/headless'
import { isGeneralProjectChat } from 'thefactory-ui/headless'
import ChatBodyForContext from './ChatBodyForContext'
import { ChatDebugModal, ChatDynamicContextModal } from 'thefactory-ui/web'
import ChatSettingsDropdownConnected from './ChatSettingsDropdownConnected'
import { SystemPromptViewerConnected } from 'thefactory-ui/web'
import { UsageModalConnected as UsageModal } from 'thefactory-ui/web'
import { ContextInfoButton } from 'thefactory-ui/web'
import { ModelChipConnected } from 'thefactory-ui/web'

export type ChatPanelBodyProps = {
  context: ChatContext
  chatContextTitle: string
  /**
   * Dismiss affordance — collapses the docked sidebar. Wired to the header's
   * collapse button.
   */
  onCollapse: () => void
  /**
   * Hosted by a surface that already carries a title and a dismiss (the
   * global chat overlay) — drops this header's collapse chevron and maximize
   * button so the chat shows a single set of chrome.
   */
  embedded?: boolean
}

/**
 * Fully-wired chat surface for a single context — `ChatBodyForContext` plus
 * the `ChatHeader` and its settings / usage / prompt / dynamic-context
 * modals. Hosted by `ChatSidebarPanelConnected` (docked) or
 * `GlobalChatOverlayConnected` (app-level assistant); the only difference is
 * how the host dismisses it. Mirrors web's same-named component.
 */
export default function ChatPanelBody({
  context,
  chatContextTitle,
  onCollapse,
  embedded = false,
}: ChatPanelBodyProps) {
  const navigate = useNavigate()
  const { projectId: urlProjectId } = useParams<{ projectId: string }>()
  const { getChat, clearChat, deleteChat } = useChats()

  const settingsBtnRef = useRef<HTMLButtonElement | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [dynamicContextOpen, setDynamicContextOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)

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
    <div className="relative h-full flex flex-col bg-(--surface-base)">
      <ChatBodyForContext
        context={context}
        header={
          <ChatHeader
            isCollapsible={!embedded}
            onCollapse={onCollapse}
            onMaximize={embedded ? undefined : openFullView}
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
            onOpenDebug={() => setDebugOpen(true)}
            onRefresh={() => {
              if (window.confirm('Clear all messages in this chat? This cannot be undone.')) {
                void clearChat(context)
              }
            }}
            onOpenSettings={() => setSettingsOpen((v) => !v)}
            settingsBtnRef={settingsBtnRef}
            isSettingsOpen={settingsOpen}
            isRunningAgent={isRunningAgent}
            modelChip={<ModelChipConnected editable className="border-blue-500" mode="chat" />}
            settingsDropdown={
              <ChatSettingsDropdownConnected
                context={context}
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                settingsBtnRef={settingsBtnRef}
                onDeleteChat={async () => {
                  if (isGeneralProjectChat(context)) {
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

      <ChatDebugModal isOpen={debugOpen} onClose={() => setDebugOpen(false)} context={context} />
    </div>
  )
}
