import React, { Dispatch, SetStateAction } from 'react'
import type { ChatContext, CompletionSettings } from 'thefactory-tools'
import { Button } from '@renderer/components/ui/Button'
import ContextInfoButton from '../../ui/ContextInfoButton'
import ModelChip from '../../agents/ModelChip'
import { IconSettings, IconChevron, IconScroll, IconRefreshChat, IconCode } from '../../ui/icons/Icons'
import { IconCalculator } from '../../ui/icons/IconCalculator'
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
  updateSettingsPrompt: (context: ChatContext, prompt: string) => Promise<void>
  resetSettingsPrompt: (context: ChatContext) => Promise<void>
  tools: ToolToggle[]
  toggleAvailable: (tool: ToolToggle) => Promise<void>
  toggleAutoCall: (tool: ToolToggle) => Promise<void>
  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>
  handleDeleteChat: () => Promise<void>
  isRunningAgent: boolean
}

export function ChatSidebarHeader({
  context,
  chatContextTitle,
  isCollapsible,
  onCollapse,
  totalCostUSD,
  formatUSD,
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
    <header className="relative flex-shrink-0 px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {isCollapsible ? (
          <button
            type="button"
            onClick={onCollapse}
            className="btn-secondary btn-icon"
            aria-label="Collapse chat sidebar"
            title="Collapse chat sidebar"
          >
            <IconChevron className="w-4 h-4" style={{ transform: 'rotate(90deg)' }} />
          </button>
        ) : null}
        <ContextInfoButton context={context} label={chatContextTitle} />
        
        <button
          onClick={() => setIsPromptModalOpen(true)}
          className="btn-secondary btn-icon"
          aria-label="View System Prompt"
          title="View System Prompt"
        >
          <IconScroll className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsCostsModalOpen(true)}
          className="btn-secondary btn-icon"
          aria-label="View usage costs"
          title={totalCostUSD > 0 ? `Total cost: ${formatUSD(totalCostUSD)}` : 'Usage costs'}
        >
          <IconCalculator className="w-4 h-4" />
        </button>

        <button
          onClick={() => setIsDynamicContextOpen(true)}
          className="btn-secondary btn-icon"
          aria-label="View dynamic context"
          title="Dynamic context"
        >
          <IconCode className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {!isRunningAgent && (
          <>
            <Button
              className="btn-secondary w-[34px]"
              variant="danger"
              aria-label="Refresh chat"
              title="Refresh chat"
              onClick={() => restartChat(context)}
            >
              <IconRefreshChat className="w-4 h-4" />
            </Button>
            <ModelChip editable className="border-blue-500" mode="chat" />

            <button
              ref={settingsBtnRef}
              onClick={() => setIsSettingsOpen((v) => !v)}
              className="btn-secondary btn-icon"
              aria-haspopup="menu"
              aria-expanded={isSettingsOpen}
              aria-label="Open Chat Settings"
              title="Chat settings"
            >
              <IconSettings className="w-4 h-4" />
            </button>
          </>
        )}

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
      </div>
    </header>
  )
}
