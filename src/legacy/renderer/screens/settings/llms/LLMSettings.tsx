import { useState } from 'react'
import { Button } from 'thefactory-ui/web'
import {
  IconChat,
  IconChevronDown,
  IconDelete,
  IconEdit,
  IconPlus,
  IconRobot,
} from 'thefactory-ui/web/icons'
import { useLLMConfig } from '../../../contexts/LLMConfigContext'
import { useNavigator } from '../../../navigation/Navigator'
import PricingPanel from './PricingPanel'

export default function LLMSettings() {
  const {
    configs,
    removeConfig,
    activeAgentRunConfigId,
    setActiveAgentRun,
    activeChatConfigId,
    setActiveChat,
  } = useLLMConfig()
  const { openModal } = useNavigator()
  const [pricingOpen, setPricingOpen] = useState(true)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* === LLM Configurations section === */}
      <div className="px-8 py-3 bg-(--surface-base) border-b border-(--border-subtle) flex items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold">LLM Configurations</h2>
        <Button
          onClick={() => openModal({ type: 'llm-config-add' })}
          title="Add config"
          aria-label="Add config"
        >
          <IconPlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-8 py-4">
        <div className="border rounded-md divide-y border-(--border-subtle) divide-(--border-subtle)">
          {configs.length === 0 ? (
            <div className="p-4 text-sm text-(--text-secondary)">
              No configurations yet. Click the + button to create one.
            </div>
          ) : (
            configs.map((cfg) => {
              const isAgentActive = activeAgentRunConfigId === cfg.id
              const isChatActive = activeChatConfigId === cfg.id
              return (
                <div
                  key={cfg.id}
                  className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      {cfg.name}
                      {isAgentActive && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-(--surface-raised) px-1.5 py-0.5 text-(--text-primary) border border-(--border-subtle)">
                          Agent active
                        </span>
                      )}
                      {isChatActive && (
                        <span className="text-[10px] uppercase tracking-wide rounded bg-(--surface-raised) px-1.5 py-0.5 text-(--text-primary) border border-(--border-subtle)">
                          Chat active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-(--text-secondary) truncate">
                      Provider: {cfg.provider} • Model: {cfg.model || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      onClick={() => setActiveAgentRun(cfg.id!)}
                      variant={isAgentActive ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={isAgentActive}
                      title={isAgentActive ? 'Already active for agent runs' : 'Use for agent runs'}
                    >
                      <IconRobot className="w-4 h-4 mr-1" />
                      {isAgentActive ? 'Agent active' : 'Set Active'}
                    </Button>
                    <Button
                      onClick={() => setActiveChat(cfg.id!)}
                      variant={isChatActive ? 'secondary' : 'outline'}
                      size="sm"
                      disabled={isChatActive}
                      title={isChatActive ? 'Already active for chat' : 'Use for chat'}
                    >
                      <IconChat className="w-4 h-4 mr-1" />
                      {isChatActive ? 'Chat active' : 'Set Chat Active'}
                    </Button>
                    <Button
                      onClick={() => openModal({ type: 'llm-config-edit', id: cfg.id! })}
                      variant="outline"
                      size="icon"
                      title="Edit"
                      aria-label="Edit"
                    >
                      <IconEdit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => removeConfig(cfg.id!)}
                      variant="danger"
                      size="icon"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <IconDelete className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="text-[12px] text-(--text-secondary) mt-2">
          Tip: Local providers must expose an OpenAI-compatible API. Use the Local preset to fill
          the default URL (http://localhost:1234/v1) and click "Load Available Models" to discover
          models.
        </div>
      </div>

      {/* === Model Pricing section === */}
      <div className="px-8 py-3 bg-(--surface-base) border-y border-(--border-subtle) flex items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold">Model Pricing</h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setPricingOpen((v) => !v)}
          title={pricingOpen ? 'Collapse' : 'Expand'}
          aria-label={pricingOpen ? 'Collapse model pricing' : 'Expand model pricing'}
          aria-expanded={pricingOpen}
        >
          <span
            className="inline-flex transition-transform"
            style={{ transform: pricingOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          >
            <IconChevronDown className="h-5 w-5" />
          </span>
        </Button>
      </div>
      {pricingOpen && (
        <div className="flex-1 min-h-0 overflow-hidden px-8 py-4">
          <PricingPanel />
        </div>
      )}
    </div>
  )
}
