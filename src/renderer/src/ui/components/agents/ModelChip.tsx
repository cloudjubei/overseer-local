import { useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { getPrice } from 'thefactory-ui/headless/api'
import { ModelChip as ModelChipBase, type ModelChipMode } from 'thefactory-ui/web'
import { useLLMConfigs } from '@core/contexts/LLMConfigsContext'

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
  mode = 'chat',
}: ModelChipProps) {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const {
    configs,
    activeChatConfig,
    activeAgentRunConfig,
    recentChatConfigs,
    recentAgentRunConfigs,
    setActiveChat,
    setActiveAgentRun,
  } = useLLMConfigs()

  const activeConfig = mode === 'chat' ? activeChatConfig : activeAgentRunConfig
  const recents = mode === 'chat' ? recentChatConfigs : recentAgentRunConfigs

  const onPick = useCallback(
    (id: string) => (mode === 'chat' ? setActiveChat(id) : setActiveAgentRun(id)),
    [mode, setActiveChat, setActiveAgentRun],
  )

  const onOpenSettings = useCallback(() => {
    if (projectId) navigate(`/projects/${projectId}/settings?tab=llms`)
    else navigate('/settings?tab=llms')
  }, [navigate, projectId])

  const baseActive = useMemo(
    () =>
      activeConfig
        ? {
            id: activeConfig.id,
            name: activeConfig.name,
            provider: activeConfig.provider,
            model: activeConfig.model,
          }
        : null,
    [activeConfig],
  )

  const baseRecents = useMemo(
    () =>
      recents.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        model: c.model,
      })),
    [recents],
  )

  const baseConfigs = useMemo(
    () =>
      configs.map((c) => ({
        id: c.id,
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
