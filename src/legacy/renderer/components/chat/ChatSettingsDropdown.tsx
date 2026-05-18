import type {
  ChatContext,
  CompletionHistorySummarization,
  CompletionMessageSanitization,
  CompletionSettings,
} from 'thefactory-tools'

import {
  ChatSettingsDropdown as ChatSettingsDropdownBase,
  HistorySummarizationSettings,
  MessageSanitizationSettings,
  type ToolToggle as ToolToggleBase,
} from 'thefactory-ui/web'

export type ToolToggle = ToolToggleBase

export type ChatSettingsDropdownProps = {
  isOpen: boolean
  onClose: () => void
  context: ChatContext

  completion?: {
    maxTurns?: number
    numberMessagesToSend?: number
    finishTurnOnErrors?: boolean
    historySummarization?: CompletionHistorySummarization
    messageSanitization?: CompletionMessageSanitization
  }

  draftPrompt: string
  setDraftPrompt: (v: string) => void
  onSavePrompt: () => Promise<void>
  onResetPrompt: () => Promise<void>

  tools: ToolToggle[]
  toggleAvailable: (tool: ToolToggle) => Promise<void>
  toggleAutoCall: (tool: ToolToggle) => Promise<void>

  persistSettings: (patch: Partial<CompletionSettings>) => Promise<void>

  onDeleteChat: () => Promise<void>

  settingsBtnRef: React.RefObject<HTMLButtonElement | null>
}

/**
 * Desktop wrapper around the shared `ChatSettingsDropdown` in
 * `thefactory-ui`. Plugs the History-summarization + Message-sanitization
 * sub-controls into the shared dropdown's `extraContent` slot so the
 * settings UI is identical between web and desktop.
 */
export default function ChatSettingsDropdown({
  isOpen,
  onClose,
  completion,
  draftPrompt,
  setDraftPrompt,
  onSavePrompt,
  onResetPrompt,
  tools,
  toggleAvailable,
  toggleAutoCall,
  persistSettings,
  onDeleteChat,
  settingsBtnRef,
}: ChatSettingsDropdownProps) {
  return (
    <ChatSettingsDropdownBase
      isOpen={isOpen}
      onClose={onClose}
      settingsBtnRef={settingsBtnRef}
      completion={completion}
      draftPrompt={draftPrompt}
      setDraftPrompt={setDraftPrompt}
      onSavePrompt={onSavePrompt}
      onResetPrompt={onResetPrompt}
      tools={tools}
      toggleAvailable={toggleAvailable}
      toggleAutoCall={toggleAutoCall}
      persistSettings={(patch) => persistSettings(patch as Partial<CompletionSettings>)}
      onDeleteChat={onDeleteChat}
      extraContent={
        <>
          <HistorySummarizationSettings
            historySummarization={completion?.historySummarization}
            persistSettings={(patch) => persistSettings(patch as Partial<CompletionSettings>)}
          />
          <MessageSanitizationSettings
            messageSanitization={completion?.messageSanitization}
            persistSettings={(patch) => persistSettings(patch as Partial<CompletionSettings>)}
          />
        </>
      }
    />
  )
}
