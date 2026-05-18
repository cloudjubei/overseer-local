import React, { Dispatch, SetStateAction } from 'react'
import type { ChatContext, CompletionSettings } from 'thefactory-tools'
import { ChatHeader } from 'thefactory-ui/web'
import ContextInfoButton from '../../ui/ContextInfoButton'
import ModelChip from '../../agents/ModelChip'
import ChatSettingsDropdown, { type ToolToggle } from '../ChatSettingsDropdown'

export type ChatSidebarHeaderProps = {
  context: ChatContext
  chatContextTitle: string
  isCollapsible?: boolean
  onCollapse?: () => void
  totalCostUSD: number
  formatUSD: (n?: number) => string
  setIsPromptModalOpen: Dispatch<SetStateAction<boolean>>
  setIsCostsModalOpen: Dispatch<SetStateAction<boolean>>
  setIsDynamicContextOpen: Dispatch<SetStateAction<boolean>>
  restartChat: (context: ChatContext) => void
  settingsBtnRef: React.MutableRefObject<HTMLButtonElement | null>
  isSettingsOpen: boolean
  setIsSettingsOpen: Dispatch<SetStateAction<boolean>>
  completion: CompletionSettings | undefined
  draftPrompt: string
  setDraftPrompt: Dispatch<SetStateAction<string>>
  updateSettingsPrompt: (context: ChatContext, prompt: string) => Promise<string | undefined>
  resetSettingsPrompt: (context: ChatContext) => Promise<string | undefined>
  tools: ToolToggle[]
  toggleAvailable: (tool: ToolToggle) => Promise<void>
  toggleAutoCall: (tool: ToolToggle) => Promise<void>
  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>
  handleDeleteChat: () => Promise<void>
  isRunningAgent: boolean
}

/**
 * Desktop-side wrapper around the shared `ChatHeader` in `thefactory-ui`.
 * Renders the same compact icon row as web, with desktop's ContextInfoButton
 * + ModelChip + the local `ChatSettingsDropdown` (which still owns the
 * deeper history-summarization / message-sanitization sub-controls).
 */
export function ChatSidebarHeader({
  context,
  chatContextTitle,
  isCollapsible,
  onCollapse,
  totalCostUSD,
  setIsPromptModalOpen,
  setIsCostsModalOpen,
  setIsDynamicContextOpen,
  restartChat,
  settingsBtnRef,
  isSettingsOpen,
  setIsSettingsOpen,
  completion,
  draftPrompt,
  setDraftPrompt,
  updateSettingsPrompt,
  resetSettingsPrompt,
  tools,
  toggleAvailable,
  toggleAutoCall,
  persistSettings,
  handleDeleteChat,
  isRunningAgent,
}: ChatSidebarHeaderProps) {
  return (
    <ChatHeader
      isCollapsible={isCollapsible}
      onCollapse={onCollapse}
      totalCostUSD={totalCostUSD}
      contextInfoSlot={<ContextInfoButton context={context} label={chatContextTitle} />}
      onOpenPrompt={() => setIsPromptModalOpen(true)}
      onOpenCosts={() => setIsCostsModalOpen(true)}
      onOpenDynamicContext={() => setIsDynamicContextOpen(true)}
      onRefresh={() => restartChat(context)}
      onOpenSettings={() => setIsSettingsOpen((v) => !v)}
      settingsBtnRef={settingsBtnRef}
      isSettingsOpen={isSettingsOpen}
      isRunningAgent={isRunningAgent}
      modelChip={<ModelChip editable className="border-blue-500" mode="chat" />}
      settingsDropdown={
        <ChatSettingsDropdown
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          context={context}
          completion={completion}
          draftPrompt={draftPrompt}
          setDraftPrompt={setDraftPrompt}
          onSavePrompt={async () => {
            await updateSettingsPrompt(context, draftPrompt)
          }}
          onResetPrompt={async () => {
            await resetSettingsPrompt(context)
          }}
          tools={tools}
          toggleAvailable={toggleAvailable}
          toggleAutoCall={toggleAutoCall}
          persistSettings={persistSettings}
          onDeleteChat={handleDeleteChat}
          settingsBtnRef={settingsBtnRef}
        />
      }
    />
  )
}
