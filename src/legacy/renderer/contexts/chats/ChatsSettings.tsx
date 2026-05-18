import { useCallback, useState } from 'react'
import type {
  ChatContext,
  ChatContextArguments,
  ChatsSettings,
  ChatSettings,
  CompletionSettings,
} from 'thefactory-tools'
import { chatsService } from '@renderer/services/chatsService'

export function extractSettingsForContext(
  all?: ChatsSettings,
  context?: ChatContext,
): ChatSettings | undefined {
  if (!all || !context) return undefined
  switch (context.type) {
    case 'GROUP':
      return all.GROUP
    case 'GROUP_TOPIC':
      return all.GROUP_TOPIC
    case 'PROJECT':
      return all.PROJECT
    case 'PROJECT_TOPIC':
      return all.PROJECT_TOPIC
    case 'STORY':
      return all.STORY
    case 'AGENT_RUN_STORY':
      return all.AGENT_RUN_STORY
    case 'FEATURE':
      return all.FEATURE
    case 'AGENT_RUN_FEATURE':
      return all.AGENT_RUN_FEATURE
    default:
      return all.GENERAL
  }
}

export function useChatSettings() {
  const [allChatSettings, setAllChatSettings] = useState<ChatsSettings | undefined>(undefined)

  const getSettings = useCallback(
    (context: ChatContext) => extractSettingsForContext(allChatSettings, context),
    [allChatSettings],
  )

  const getDefaultPrompt = useCallback(async (chatContext: ChatContext): Promise<string> => {
    try {
      return await chatsService.getDefaultPrompt(chatContext)
    } catch (e) {
      console.error('Failed to get default prompt', e)
      return ''
    }
  }, [])

  const getSettingsPrompt = useCallback(
    async (contextArguments: ChatContextArguments): Promise<string> => {
      try {
        return await chatsService.getSettingsPrompt(contextArguments)
      } catch (e) {
        console.error('Failed to get settings prompt', e)
        return ''
      }
    },
    [],
  )

  const updateSettingsPrompt = useCallback(
    async (context: ChatContext, prompt: string): Promise<string | undefined> => {
      try {
        const updated = await chatsService.updateSettingsPrompt(context, prompt)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)?.systemPrompt
      } catch (e) {
        console.error('Failed to update settings prompt', e)
      }
      return undefined
    },
    [],
  )

  const resetSettingsPrompt = useCallback(
    async (context: ChatContext): Promise<string | undefined> => {
      try {
        const updated = await chatsService.resetSettingsPrompt(context)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)?.systemPrompt
      } catch (e) {
        console.error('Failed to reset settings prompt', e)
      }
      return undefined
    },
    [],
  )

  const updateCompletionSettings = useCallback(
    async (
      context: ChatContext,
      patch: Partial<CompletionSettings>,
    ): Promise<ChatSettings | undefined> => {
      try {
        const updated = await chatsService.updateChatCompletionSettings(context, patch)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)
      } catch (e) {
        console.error('Failed to update chat settings', e)
        return extractSettingsForContext(allChatSettings, context)
      }
    },
    [allChatSettings],
  )

  const resetSettings = useCallback(
    async (context: ChatContext): Promise<ChatSettings | undefined> => {
      try {
        const updated = await chatsService.resetChatSettings(context)
        setAllChatSettings(updated)
        return extractSettingsForContext(updated, context)
      } catch (e) {
        console.error('Failed to reset chat settings', e)
        return extractSettingsForContext(allChatSettings, context)
      }
    },
    [allChatSettings],
  )

  return {
    allChatSettings,
    setAllChatSettings,
    getSettings,
    getDefaultPrompt,
    getSettingsPrompt,
    updateSettingsPrompt,
    resetSettingsPrompt,
    updateCompletionSettings,
    resetSettings,
  }
}
