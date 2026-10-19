import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CHAT_NOTIFY_LEVEL_LABELS,
  chatCloseAction,
  chatClosure,
  chatSettingsMenuItems,
  isGeneralGroupChat,
  isGeneralProjectChat,
  isGlobalChat,
  processRunIdOfChatContext,
  useAppSettings,
  useChatHeaderView,
  useChatNotifyLevel,
  useChats,
  type ChatSettingsMenuKey,
} from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import {
  ChatDebugModal,
  ChatDynamicContextModal,
  ChatHeader,
  ChatNotifyLevelPicker,
  ChatSettingsMenu,
  ContextInfoButton,
  Modal,
  ModelChipConnected,
  SystemPromptViewerConnected,
  UsageModalConnected as UsageModal,
} from 'thefactory-ui/web'
import { getChatContextKey } from '@core/chats/chatKey'
import ChatSettingsDropdownConnected from './ChatSettingsDropdownConnected'

export type ChatHeaderConnectedProps = {
  context: ChatContext
  /** The host's own name for the chat — a docked panel's "Tests — TheFactory Tools". */
  title?: string
  /** A narrow host — a docked panel or a sheet: the steps strip folds to its narrow form. */
  narrow?: boolean
  onCollapse?: () => void
  onMaximize?: () => void
  /** Docked beside what the chat is about (a run's chat beside its run): the slim header with this label. */
  dockedLabel?: string
  /** Opens another chat — the summary chat closing an agent-run chat down leads to. */
  onOpenChat?: (context: ChatContext) => void
  /** Where to go once the chat is deleted. */
  onDeleted?: () => void
}

/**
 * The chat header with everything behind it: the header view, the settings
 * menu and what each row opens — turn limit and tools, the developer tools,
 * clearing and deleting the chat.
 */
export default function ChatHeaderConnected({
  context,
  title,
  narrow = false,
  onCollapse,
  onMaximize,
  onOpenChat,
  onDeleted,
  dockedLabel,
}: ChatHeaderConnectedProps) {
  const navigate = useNavigate()
  const { getChat, clearChat, consolidateChat, deleteChat, hideChatFromList, showChatInList } =
    useChats()
  const { settings } = useAppSettings()
  const headerView = useChatHeaderView(context)
  const view = title ? { ...headerView, title } : headerView
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [dynamicContextOpen, setDynamicContextOpen] = useState(false)
  const [debugOpen, setDebugOpen] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const { level: notifyLevel } = useChatNotifyLevel(context)

  const chat = getChat(context)
  const isAgentRunChat = context.type === 'AGENT_RUN_STORY' || context.type === 'AGENT_RUN_FEATURE'
  const isRunningAgent = isAgentRunChat && (chat?.state === 'created' || chat?.state === 'running')
  const closeAction = chatCloseAction(context, chatClosure(chat))
  const isAssistant = isGlobalChat({ context })
  const items = chatSettingsMenuItems({
    notifyLevel: CHAT_NOTIFY_LEVEL_LABELS[notifyLevel],
    canTune: !isRunningAgent,
    listHidden: !!chat?.listHiddenAt,
    showDeveloperTools: settings.userPreferences.showDeveloperTools === true,
    ...(!isRunningAgent && !closeAction.done ? { clearLabel: closeAction.label } : {}),
    canDelete: !isAgentRunChat && !isGeneralProjectChat(context) && !isGeneralGroupChat(context),
    assistant: isAssistant,
  })

  const closeChat = () => {
    if (!window.confirm(closeAction.confirm)) return
    if (closeAction.kind !== 'consolidate') {
      void clearChat(context)
      return
    }
    void consolidateChat(context).then((successor) => {
      if (successor) onOpenChat?.(successor)
    })
  }

  const removeChat = async () => {
    const noun = isAssistant ? 'conversation' : 'chat'
    if (!window.confirm(`Delete this ${noun}? This action cannot be undone.`)) return
    try {
      await deleteChat(context)
    } catch (e) {
      console.error(`Failed to delete ${noun}`, e)
      window.alert(`Failed to delete the ${noun}. Please try again.`)
      return
    }
    onDeleted?.()
  }

  const onSelect = (key: ChatSettingsMenuKey) => {
    switch (key) {
      case 'notify':
        setNotifyOpen(true)
        return
      case 'tune':
        setSettingsOpen(true)
        return
      case 'archive':
        void (chat?.listHiddenAt ? showChatInList(context) : hideChatFromList(context))
        return
      case 'prompt':
        setPromptOpen(true)
        return
      case 'costs':
        setUsageOpen(true)
        return
      case 'dynamic-context':
        setDynamicContextOpen(true)
        return
      case 'debug':
        setDebugOpen(true)
        return
      case 'clear':
        closeChat()
        return
      case 'delete':
        void removeChat()
        return
    }
  }

  const contextInfo = (
    <ContextInfoButton
      storyId={context.storyId}
      featureId={context.featureId}
      processRunId={processRunIdOfChatContext(context)}
      onOpenProcessRun={(id) => navigate(`/projects/${context.projectId}/process-runs/${id}`)}
      label={view.title}
    />
  )
  const modelChip = (
    <ModelChipConnected editable className="border-blue-500" mode="chat" chatContext={context} />
  )
  const settingsMenu = <ChatSettingsMenu items={items} onSelect={onSelect} />
  const settingsPanel = (
    <ChatSettingsDropdownConnected
      context={context}
      isOpen={settingsOpen}
      onClose={() => setSettingsOpen(false)}
    />
  )

  return (
    <>
      <ChatHeader
        view={view}
        narrow={narrow}
        contextInfoSlot={contextInfo}
        modelChip={modelChip}
        settingsMenu={settingsMenu}
        settingsPanel={settingsPanel}
        {...(onCollapse ? { onCollapse } : {})}
        {...(onMaximize ? { onMaximize } : {})}
        {...(dockedLabel !== undefined ? { dockedLabel } : {})}
      />
      <UsageModal
        isOpen={usageOpen}
        onClose={() => setUsageOpen(false)}
        messages={chat?.messages ?? []}
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
      <Modal isOpen={notifyOpen} onClose={() => setNotifyOpen(false)} title="Notify me" size="sm">
        <ChatNotifyLevelPicker context={context} onPicked={() => setNotifyOpen(false)} />
      </Modal>
    </>
  )
}
