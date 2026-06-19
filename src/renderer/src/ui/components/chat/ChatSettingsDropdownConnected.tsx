import { useEffect, useMemo, useState, type RefObject } from 'react'
import { useChats } from 'thefactory-ui/headless'
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

/**
 * Web wrapper around the shared `ChatSettingsDropdown`. Reads + persists
 * settings via `ChatsContext.updateChatSettings`, holds the draft system
 * prompt locally so the user can edit before saving, surfaces the
 * project's tool list as `available` / `autoCall` toggles, and plugs the
 * History-summarization + Message-sanitization sub-controls into the
 * dropdown's `extraContent` slot.
 *
 * Mirrors `overseer-local`'s ChatSidebar settings wiring 1:1.
 */
export default function ChatSettingsDropdownConnected({
  context,
  isOpen,
  onClose,
  settingsBtnRef,
  onDeleteChat,
}: ChatSettingsDropdownConnectedProps) {
  const { getEffectiveChatSettings, updateChatSettings, settingsBlocked } = useChats()

  const effective = getEffectiveChatSettings(context)
  const completion = effective.completionSettings
  const persistedPrompt = effective.systemPrompt ?? ''

  const [draftPrompt, setDraftPrompt] = useState(persistedPrompt)
  useEffect(() => {
    setDraftPrompt(persistedPrompt)
  }, [persistedPrompt, context.type, context.projectId, context.storyId, context.featureId])

  const tools = useMemo<ToolToggle[]>(() => {
    const available = new Set(completion?.availableTools ?? [])
    const auto = new Set(completion?.autoCallTools ?? [])
    const names = Array.from(
      new Set([...(completion?.availableTools ?? []), ...(completion?.autoCallTools ?? [])]),
    )
    return names.map((name) => ({
      name,
      description: '',
      available: available.has(name),
      autoCall: auto.has(name),
    }))
  }, [completion])

  const toggleAvailable = async (tool: ToolToggle) => {
    const next = !tool.available
    const avail = new Set(completion?.availableTools ?? [])
    const auto = new Set(completion?.autoCallTools ?? [])
    if (next) avail.add(tool.name)
    else {
      avail.delete(tool.name)
      auto.delete(tool.name)
    }
    await updateChatSettings(context, {
      completionSettings: {
        ...(completion ?? ({} as never)),
        availableTools: Array.from(avail),
        autoCallTools: Array.from(auto),
      },
    })
  }

  const toggleAutoCall = async (tool: ToolToggle) => {
    if (!tool.available) return
    const auto = new Set(completion?.autoCallTools ?? [])
    if (tool.autoCall) auto.delete(tool.name)
    else auto.add(tool.name)
    await updateChatSettings(context, {
      completionSettings: {
        ...(completion ?? ({} as never)),
        autoCallTools: Array.from(auto),
      },
    })
  }

  const persistCompletion = async (patch: Record<string, unknown>) => {
    await updateChatSettings(context, {
      completionSettings: {
        ...(completion ?? ({} as never)),
        ...(patch as Partial<typeof completion>),
      },
    })
  }

  return (
    <ChatSettingsDropdown
      isOpen={isOpen}
      onClose={onClose}
      settingsBtnRef={settingsBtnRef}
      blocked={settingsBlocked}
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
