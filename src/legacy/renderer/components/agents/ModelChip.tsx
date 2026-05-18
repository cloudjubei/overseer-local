import { useCallback, useMemo } from 'react'

import { ModelChip as ModelChipBase, type ModelChipMode } from 'thefactory-ui/web'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import { getPrice } from '../../services/pricingService'

export type ModelChipProps = {
  provider?: string
  model?: string
  className?: string
  editable?: boolean
  mode?: ModelChipMode
}

export default function ModelChip({
  provider,
  model,
  className,
  editable = false,
  mode = 'agentRun',
}: ModelChipProps) {
  const {
    configs,
    activeAgentRunConfig,
    recentAgentRunConfigs,
    setActiveAgentRun,
    activeChatConfig,
    recentChatConfigs,
    setActiveChat,
  } = useLLMConfig()
  const { navigateView } = useNavigator()

  const activeConfig = mode === 'chat' ? activeChatConfig : activeAgentRunConfig
  const recents = mode === 'chat' ? recentChatConfigs : recentAgentRunConfigs

  const onPick = useCallback(
    (id: string) => (mode === 'chat' ? setActiveChat(id) : setActiveAgentRun(id)),
    [mode, setActiveChat, setActiveAgentRun],
  )

  const onOpenSettings = useCallback(
    () => navigateView('Settings', { settingsTab: 'llms' }),
    [navigateView],
  )

  const baseActive = useMemo(
    () =>
      activeConfig
        ? {
            id: activeConfig.id!,
            name: activeConfig.name,
            provider: activeConfig.provider,
            model: activeConfig.model,
          }
        : null,
    [activeConfig],
  )

  const baseRecents = useMemo(
    () =>
      recents
        .filter((c) => c.id)
        .map((c) => ({
          id: c.id!,
          name: c.name,
          provider: c.provider,
          model: c.model,
        })),
    [recents],
  )

  const baseConfigs = useMemo(
    () =>
      configs
        .filter((c) => c.id)
        .map((c) => ({
          id: c.id!,
          name: c.name,
          provider: c.provider,
          model: c.model,
        })),
    [configs],
  )

  return (
    <ModelChipBase
      provider={provider}
      model={model}
      className={className}
      editable={editable}
      mode={mode}
      activeConfig={baseActive}
      recents={baseRecents}
      configs={baseConfigs}
      onPick={onPick}
      onOpenSettings={onOpenSettings}
      getPrice={getPrice}
    />
  )
}
