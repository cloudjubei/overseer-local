import { Button } from '../../../components/ui/Button'
import { IconEdit, IconDelete, IconPlus } from '../../../components/ui/icons/Icons'
import { useLLMConfig } from '../../../contexts/LLMConfigContext'
import { useNavigator } from '../../../navigation/Navigator'

export default function LLMSettings() {
  const {
    configs,
    activeAgentRunConfigId,
    activeChatConfigId,
    removeConfig,
    setActiveAgentRun,
    setActiveChat,
  } = useLLMConfig()
  const { openModal } = useNavigator()

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">LLM Configurations</h2>
        <Button onClick={() => openModal({ type: 'llm-config-add' })}>
          <IconPlus className="h-[20px] w-[20px]" />
        </Button>
      </div>
      <div className="border rounded-md divide-y">
        {configs.length === 0 && (
          <div className="p-4 text-sm text-gray-600">
            No configurations yet. Click "Add New Config" to create one.
          </div>
        )}
        {configs.map((cfg) => (
          <div
            key={cfg.id}
            className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium truncate flex items-center gap-2">
                <span className="truncate">{cfg.name}</span>
                {activeAgentRunConfigId === cfg.id ? (
                  <span className="badge badge--soft badge--done">Active</span>
                ) : null}
                {activeChatConfigId === cfg.id ? (
                  <span className="badge badge--soft badge--info">Chat Active</span>
                ) : null}
              </div>
              <div className="text-sm text-gray-600 truncate">
                Provider: {cfg.provider} • Model: {cfg.model || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeAgentRunConfigId !== cfg.id && (
                <Button onClick={() => setActiveAgentRun(cfg.id!)}>Set Active</Button>
              )}
              {activeChatConfigId !== cfg.id && (
                <Button variant="outline" onClick={() => setActiveChat(cfg.id!)}>
                  Set Chat Active
                </Button>
              )}
              <Button
                onClick={() => openModal({ type: 'llm-config-edit', id: cfg.id! })}
                variant="outline"
              >
                <IconEdit className="w-4 h-4" />
              </Button>
              <Button onClick={() => removeConfig(cfg.id!)} variant="danger">
                <IconDelete className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] mt-2">
        Tip: Local providers must expose an OpenAI-compatible API. Use the Local preset to fill the
        default URL (http://localhost:1234/v1) and click "Load Available Models" to discover models.
      </div>
    </div>
  )
}
