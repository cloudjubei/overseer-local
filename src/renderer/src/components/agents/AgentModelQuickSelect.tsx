import { useMemo } from 'react'
import { AgentModelQuickSelect as AgentModelQuickSelectBase } from 'thefactory-ui/web'
import { useNavigator } from '../../navigation/Navigator'
import { useLLMConfig } from '../../contexts/LLMConfigContext'

export default function AgentModelQuickSelect({ className = '' }: { className?: string }) {
  const { setActiveAgentRun, recentAgentRunConfigs, activeAgentRunConfigId, configs } =
    useLLMConfig()
  const { navigateView } = useNavigator()

  const options = useMemo(
    () =>
      recentAgentRunConfigs
        .filter((c) => c.id)
        .map((c) => ({ id: c.id!, name: c.name ?? c.id!, model: c.model })),
    [recentAgentRunConfigs],
  )

  return (
    <AgentModelQuickSelectBase
      value={activeAgentRunConfigId || ''}
      options={options}
      onPick={setActiveAgentRun}
      onOpenSettings={() => navigateView('Settings')}
      className={className}
      ariaLabel="Agent Model"
      placeholder={configs && configs.length > 0 ? 'Select Model' : undefined}
    />
  )
}
