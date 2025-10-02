import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { useNavigator } from '../../navigation/Navigator'
import { useLLMConfig } from '../../contexts/LLMConfigContext'

export default function AgentModelQuickSelect({ className = '' }: { className?: string }) {
  const {
    recentConfigs,
    activeAgentRunConfigId: activeConfigId,
    setActive,
    configs,
  } = useLLMConfig()
  const { navigateView } = useNavigator()

  if (!configs || configs.length === 0) {
    return (
      <button
        type="button"
        className={`btn-secondary no-drag ${className}`}
        onClick={() => navigateView('Settings')}
        title="No LLMs configured. Open Settings to add one."
        aria-label="Configure LLMs"
      >
        Configure LLM…
      </button>
    )
  }

  return (
    <div className={`no-drag ${className}`}>
      <Select
        value={activeConfigId || ''}
        onValueChange={(v) => {
          if (v === '__open_settings') {
            navigateView('Settings')
            return
          }
          setActive(v)
        }}
      >
        <SelectTrigger className="ui-select w-[220px]" aria-label="Agent Model">
          <SelectValue placeholder="Select Model" />
        </SelectTrigger>
        <SelectContent>
          {recentConfigs.map((cfg) => (
            <SelectItem key={cfg.id} value={cfg.id!}>
              {cfg.name} {cfg.model ? `(${cfg.model})` : ''}
            </SelectItem>
          ))}
          <SelectItem value="__open_settings">Manage LLM Configurations…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
