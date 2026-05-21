import { useRef, useState } from 'react'
import { useLLMConfigs } from '@core/contexts/LLMConfigsContext'
import type { GetLlmConfigResponse } from 'thefactory-ui/headless/api'
import { Alert, Button, ConfirmDialog, Modal } from 'thefactory-ui/web'
import {
  IconChat,
  IconChevronDown,
  IconDelete,
  IconEdit,
  IconPlus,
  IconRobot,
} from 'thefactory-ui/web/icons'
import LLMConfigForm, { type LLMConfigFormHandle } from './LLMConfigForm'
import PricingPanel from './PricingPanel'

type ModalRoute =
  | { kind: 'create' }
  | { kind: 'edit'; config: GetLlmConfigResponse }
  | { kind: 'delete'; config: GetLlmConfigResponse }

export default function LLMSettings() {
  const {
    isLoaded,
    loadError,
    configs,
    createConfig,
    updateConfig,
    deleteConfig,
    activeChatConfigId,
    setActiveChat,
    activeAgentRunConfigId,
    setActiveAgentRun,
  } = useLLMConfigs()
  const [modal, setModal] = useState<ModalRoute | null>(null)
  const [pricingOpen, setPricingOpen] = useState(true)
  const formRef = useRef<LLMConfigFormHandle | null>(null)

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* === LLM Configurations section === */}
      <div className="px-8 py-3 bg-(--surface-base) border-b border-(--border-subtle) flex items-center justify-between shrink-0">
        <h2 className="text-xl font-semibold">LLM Configurations</h2>
        <Button
          onClick={() => setModal({ kind: 'create' })}
          title="Add config"
          aria-label="Add config"
        >
          <IconPlus className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-8 py-4">
        {loadError && (
          <div className="mb-3">
            <Alert>{loadError.message}</Alert>
          </div>
        )}

        <div className="border rounded-md divide-y border-(--border-subtle) divide-(--border-subtle)">
          {!isLoaded ? (
            <div className="p-4 text-sm text-(--text-secondary)">Loading…</div>
          ) : configs.length === 0 ? (
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
                    <div className="font-medium truncate">{cfg.name}</div>
                    <div className="text-sm text-(--text-secondary) truncate">
                      Provider: {cfg.provider} • Model: {cfg.model || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => {
                          if (!isAgentActive) setActiveAgentRun(cfg.id)
                        }}
                        variant={isAgentActive ? 'success' : 'outline'}
                        size="sm"
                        title={isAgentActive ? 'Active for agent runs' : 'Use for agent runs'}
                      >
                        <IconRobot className="w-4 h-4 mr-1" />
                        {isAgentActive ? 'Agent Active' : 'Activate Agent'}
                      </Button>
                      <Button
                        onClick={() => {
                          if (!isChatActive) setActiveChat(cfg.id)
                        }}
                        variant={isChatActive ? 'success' : 'outline'}
                        size="sm"
                        title={isChatActive ? 'Active for chat' : 'Use for chat'}
                      >
                        <IconChat className="w-4 h-4 mr-1" />
                        {isChatActive ? 'Chat Active' : 'Activate Chat'}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setModal({ kind: 'edit', config: cfg })}
                        variant="outline"
                        size="icon"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <IconEdit className="w-4 h-4" />
                      </Button>
                      <Button
                        onClick={() => setModal({ kind: 'delete', config: cfg })}
                        variant="danger"
                        size="icon"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <IconDelete className="w-4 h-4" />
                      </Button>
                    </div>
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

      {modal?.kind === 'create' && (
        <Modal isOpen onClose={() => formRef.current?.requestClose()} title="New LLM config">
          <LLMConfigForm
            ref={formRef}
            mode={{ kind: 'create', onSubmit: createConfig }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.kind === 'edit' && (
        <Modal
          isOpen
          onClose={() => formRef.current?.requestClose()}
          title={`Edit: ${modal.config.name}`}
        >
          <LLMConfigForm
            ref={formRef}
            mode={{
              kind: 'edit',
              config: modal.config,
              onSubmit: (patch) => updateConfig(modal.config.id, patch),
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          isOpen
          onClose={() => setModal(null)}
          title="Delete LLM config"
          description={`This removes "${modal.config.name}". Existing chat history is unaffected.`}
          confirmLabel="Delete"
          destructive
          onConfirm={() => deleteConfig(modal.config.id)}
        />
      )}
    </div>
  )
}
