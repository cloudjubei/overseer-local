import { useEffect, useMemo, useState, type RefObject } from 'react'
import {
  applyChatToolApprovalMode,
  applyChatToolToggle,
  buildChatToolApprovalToggle,
  buildChatToolToggles,
  resetChatToolToggles,
  useChats,
  useChatCliRunner,
  useChatToolCatalog,
} from 'thefactory-ui/headless'
import type { ChatContext } from 'thefactory-ui/headless/api'
import {
  ChatSettingsDropdown,
  HistorySummarizationSettings,
  MessageSanitizationSettings,
  type ToolToggle,
} from 'thefactory-ui/web'

export type ChatSettingsDropdownConnectedProps = {
  context: ChatContext
  isOpen: boolean
  onClose: () => void
  settingsBtnRef: RefObject<HTMLButtonElement | null>
  onDeleteChat: () => Promise<void> | void
}

const CLI_TOOLS_HINT =
  'These are the factory tools this CLI agent can reach. Its own file and shell tools are bounded by the sandbox, not by this list.'

/**
 * Desktop wrapper around the shared `ChatSettingsDropdown`. Reads + persists
 * settings via `ChatsContext.updateChatSettings`, holds the draft system
 * prompt locally so the user can edit before saving, and plugs the
 * History-summarization + Message-sanitization sub-controls into the
 * dropdown's `extraContent` slot.
 *
 * The tool rows come from the backend catalogue for this chat's transport
 * (`useChatToolCatalog`), not from the chat's own stored settings — deriving
 * them from the settings made a tool the chat did not already carry impossible
 * to switch on. All row/patch logic lives in `thefactory-ui/headless` so the
 * three clients cannot drift.
 */
export default function ChatSettingsDropdownConnected({
  context,
  isOpen,
  onClose,
  settingsBtnRef,
  onDeleteChat,
}: ChatSettingsDropdownConnectedProps) {
  const { getEffectiveChatSettings, updateChatSettings, settingsBlocked } = useChats()
  const { cliRunner } = useChatCliRunner(context)
  const runner = cliRunner ? 'cli' : 'api'
  const { catalog } = useChatToolCatalog(runner)

  const effective = getEffectiveChatSettings(context)
  const completion = effective.completionSettings
  const persistedPrompt = effective.systemPrompt ?? ''

  const [draftPrompt, setDraftPrompt] = useState(persistedPrompt)
  useEffect(() => {
    setDraftPrompt(persistedPrompt)
  }, [persistedPrompt, context.type, context.projectId, context.storyId, context.featureId])

  const tools = useMemo<ToolToggle[]>(
    () => buildChatToolToggles(catalog, completion, runner),
    [catalog, completion, runner],
  )

  const persistCompletion = async (patch: Record<string, unknown>) => {
    await updateChatSettings(context, {
      completionSettings: {
        ...(completion ?? ({} as never)),
        ...(patch as Partial<typeof completion>),
      },
    })
  }

  const toggleAvailable = async (tool: ToolToggle) => {
    const patch = applyChatToolToggle(
      catalog,
      completion,
      runner,
      tool.name,
      'available',
      !tool.available,
    )
    if (Object.keys(patch).length === 0) return
    await persistCompletion(patch)
  }

  const toggleAutoCall = async (tool: ToolToggle) => {
    const patch = applyChatToolToggle(
      catalog,
      completion,
      runner,
      tool.name,
      'autoCall',
      !tool.autoCall,
    )
    if (Object.keys(patch).length === 0) return
    await persistCompletion(patch)
  }

  return (
    <ChatSettingsDropdown
      isOpen={isOpen}
      onClose={onClose}
      settingsBtnRef={settingsBtnRef}
      blocked={settingsBlocked}
      cliBacked={!!cliRunner}
      completion={completion}
      draftPrompt={draftPrompt}
      setDraftPrompt={setDraftPrompt}
      onSavePrompt={async () => {
        await updateChatSettings(context, { systemPrompt: draftPrompt })
      }}
      onResetPrompt={async () => {
        await updateChatSettings(context, { systemPrompt: '' })
        setDraftPrompt('')
      }}
      tools={tools}
      toggleAvailable={toggleAvailable}
      toggleAutoCall={toggleAutoCall}
      onResetTools={
        runner === 'cli' ? () => persistCompletion(resetChatToolToggles(runner)) : undefined
      }
      toolsHint={runner === 'cli' ? CLI_TOOLS_HINT : undefined}
      toolApproval={buildChatToolApprovalToggle(completion, runner)}
      onToolApprovalChange={async (auto) => {
        const patch = applyChatToolApprovalMode(runner, auto)
        if (Object.keys(patch).length === 0) return
        await persistCompletion(patch)
      }}
      persistSettings={persistCompletion}
      onDeleteChat={onDeleteChat}
      extraContent={
        <>
          <HistorySummarizationSettings
            historySummarization={completion?.historySummarization}
            persistSettings={(patch) => persistCompletion(patch)}
          />
          <MessageSanitizationSettings
            messageSanitization={completion?.messageSanitization}
            persistSettings={(patch) => persistCompletion(patch)}
          />
        </>
      }
    />
  )
}
