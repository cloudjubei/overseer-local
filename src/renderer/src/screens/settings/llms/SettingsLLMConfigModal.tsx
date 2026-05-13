import {
  Alert,
  Button,
  ConfirmDialog,
  Input,
  Modal,
  SecretInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from 'thefactory-ui/web'
import { IconChat, IconRobot, IconSave } from 'thefactory-ui/web/icons'
import { useLLMConfig } from '@renderer/contexts/LLMConfigContext'
import { llmConfigsService } from '@renderer/services/llmConfigsService'
import { extractErrorMessage } from '@renderer/utils/errorMessage'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LLMConfig, LLMProvider } from 'thefactory-tools'
import { DEFAULT_PROVIDER_ENDPOINTS } from 'thefactory-tools/utils'

const PROVIDERS: Array<{ value: LLMProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'custom', label: 'Custom' },
]

const PROVIDERS_WITH_MODEL_LISTING = new Set<LLMProvider>([
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'custom',
])

export default function SettingsLLMConfigModal({
  mode,
  id,
  onRequestClose,
}: {
  mode: 'add' | 'edit'
  id?: string
  onRequestClose: () => void
}) {
  const {
    configs,
    addConfig,
    updateConfig,
    activeChatConfigId,
    setActiveChat,
    activeAgentRunConfigId,
    setActiveAgentRun,
  } = useLLMConfig()
  const { toast } = useToast()
  const isEdit = mode === 'edit'
  const existing = isEdit ? configs.find((c) => c.id === id) || null : null

  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('custom')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  const initialForm: LLMConfig = existing || {
    id: '',
    name: '',
    provider: 'openai',
    apiKey: '',
    model: '',
  }
  const [form, setForm] = useState<LLMConfig>(() => initialForm)

  // Tracks whether the user has actually touched a form field. Background
  // effects like the initial models load do NOT flip this — only user
  // interaction does. So opening an existing config and closing without
  // typing/clicking never triggers the discard prompt.
  const dirtyRef = useRef(false)
  const markDirty = () => {
    dirtyRef.current = true
  }

  const applyModelOptions = (models: string[], currentModel: string) => {
    const uniqueModels = Array.from(
      new Set(models.filter((m) => typeof m === 'string' && m.trim().length > 0)),
    )
    setAvailableModels(uniqueModels)
    // Reconcile mode only in one direction: if we're in 'preset' but the
    // saved model is no longer in the available list, fall back to 'custom'
    // so the value is still editable. NEVER flip 'custom' → 'preset'
    // automatically — that would silently throw away the user's intent and
    // make the custom input vanish on auto-load.
    if (currentModel && !uniqueModels.includes(currentModel)) setModelMode('custom')
  }

  const loadAvailableModels = async (config: LLMConfig, options?: { silent?: boolean }) => {
    if (!PROVIDERS_WITH_MODEL_LISTING.has(config.provider)) {
      applyModelOptions([], config.model)
      setModelsError(null)
      return
    }

    setModelsLoading(true)
    setModelsError(null)

    try {
      const models = await llmConfigsService.listAvailableModels(config)
      const names = models.map((item) => item.model)
      applyModelOptions(names, config.model)
    } catch (e) {
      applyModelOptions([], config.model)
      const description = e instanceof Error ? e.message : String(e)
      setModelsError(description)
      if (!options?.silent) {
        toast({ title: 'Failed to load models', description, variant: 'error' })
      }
    } finally {
      setModelsLoading(false)
    }
  }

  useEffect(() => {
    const next = existing || {
      id: '',
      name: '',
      provider: 'openai' as LLMProvider,
      apiKey: '',
      model: '',
    }

    setForm(next)
    void loadAvailableModels(next, { silent: true })
  }, [existing])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    markDirty()
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'apiUrlOverride' && value === '' ? undefined : value,
    }))
  }

  const onProviderChange = (value: LLMProvider) => {
    if (value === form.provider) return // Radix syncing — not a real user change
    markDirty()
    const next: LLMConfig = {
      ...form,
      provider: value,
      model: '',
      apiUrlOverride: undefined,
    }

    setForm(next)
    setModelsError(null)
    setAvailableModels([])
    setModelMode('custom')
    void loadAvailableModels(next, { silent: true })
  }

  const handleModelSelect = (value: string) => {
    if (value === 'custom') {
      // Bail out if we're already in custom mode — defends against Radix
      // firing onValueChange when the controlled value prop changes from a
      // preset value to 'custom' due to a mode reconciliation.
      if (modelMode === 'custom') return
      markDirty()
      setModelMode('custom')
      setForm((prev) => ({ ...prev, model: '' }))
    } else {
      if (modelMode === 'preset' && form.model === value) return
      markDirty()
      setModelMode('preset')
      setForm((prev) => ({ ...prev, model: value }))
    }
  }

  const attemptClose = () => {
    if (submitting) return
    if (dirtyRef.current) setDiscardOpen(true)
    else onRequestClose()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!form.name || !form.provider || !form.model) {
      setSubmitError('Please provide name, provider, and model.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      if (isEdit) {
        await updateConfig(form.id!, { ...form })
      } else {
        const { id: _omit, ...toAdd } = form
        await addConfig(toAdd)
      }
      onRequestClose()
    } catch (err) {
      const message = extractErrorMessage(
        err,
        'The backend rejected this LLM configuration. Double-check the provider, model, API key, and URL override.',
      )
      setSubmitError(message)
      toast({ title: 'Failed to save', description: message, variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const providerSupportsRefresh = PROVIDERS_WITH_MODEL_LISTING.has(form.provider)
  const providerModels = useMemo(() => availableModels, [availableModels])
  const isChatActive = isEdit && existing ? activeChatConfigId === existing.id : false
  const isAgentActive = isEdit && existing ? activeAgentRunConfigId === existing.id : false

  return (
    <Modal
      isOpen={true}
      onClose={attemptClose}
      title={isEdit ? 'Edit LLM Configuration' : 'Add LLM Configuration'}
    >
      {submitError && (
        <div className="mb-3">
          <Alert variant="error">{submitError}</Alert>
        </div>
      )}
      {isEdit && existing && (
        <div className="mb-3 flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setActiveAgentRun(existing.id!)}
            variant={isAgentActive ? 'secondary' : 'outline'}
            size="sm"
            disabled={isAgentActive}
            title={isAgentActive ? 'Already active for agent runs' : 'Use for agent runs'}
          >
            <IconRobot className="w-4 h-4 mr-1" />
            {isAgentActive ? 'Agent active' : 'Set Active'}
          </Button>
          <Button
            type="button"
            onClick={() => setActiveChat(existing.id!)}
            variant={isChatActive ? 'secondary' : 'outline'}
            size="sm"
            disabled={isChatActive}
            title={isChatActive ? 'Already active for chat' : 'Use for chat'}
          >
            <IconChat className="w-4 h-4 mr-1" />
            {isChatActive ? 'Chat active' : 'Set Chat Active'}
          </Button>
        </div>
      )}

      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <Input
            id="name"
            name="name"
            placeholder="My Provider"
            value={form.name}
            onChange={onChange}
          />
        </div>

        <div>
          <label htmlFor="provider" className="block text-sm font-medium mb-1">
            Provider
          </label>
          <Select value={form.provider} onValueChange={(v) => onProviderChange(v as LLMProvider)}>
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.value} value={provider.value}>
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
            API Key {form.provider === 'custom' ? '(optional)' : ''}
          </label>
          <SecretInput
            id="apiKey"
            name="apiKey"
            placeholder={form.provider === 'custom' ? 'Optional bearer token' : 'sk-...'}
            value={form.apiKey}
            onChange={onChange}
            revealConfirmDescription="The API key will be visible until you leave this page."
          />
        </div>

        <div>
          <label htmlFor="apiUrlOverride" className="block text-sm font-medium mb-1">
            API URL {form.provider === 'custom' ? '' : '(optional)'}
          </label>
          <Input
            id="apiUrlOverride"
            name="apiUrlOverride"
            placeholder={DEFAULT_PROVIDER_ENDPOINTS[form.provider]('') ?? undefined}
            value={form.apiUrlOverride || ''}
            onChange={onChange}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="model" className="block text-sm font-medium">
              Model
            </label>
            {providerSupportsRefresh && (
              <Button
                type="button"
                onClick={() => void loadAvailableModels(form)}
                disabled={modelsLoading}
                variant="outline"
              >
                {modelsLoading ? 'Loading…' : 'Refresh Models'}
              </Button>
            )}
          </div>

          {providerModels.length > 0 && (
            <Select
              value={modelMode === 'preset' ? form.model : 'custom'}
              onValueChange={handleModelSelect}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          )}

          {(modelMode === 'custom' || providerModels.length === 0) && (
            <Input
              className="mt-2"
              name="model"
              placeholder="model-id"
              value={form.model}
              onChange={onChange}
            />
          )}

          {modelsError && <p className="text-red-500 text-sm mt-1">{modelsError}</p>}
        </div>

        <div className="flex justify-end pt-2">
          {isEdit ? (
            <Button
              type="submit"
              variant="secondary"
              size="icon"
              loading={submitting}
              title="Save"
              aria-label="Save"
            >
              <IconSave className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="submit" loading={submitting}>
              Add
            </Button>
          )}
        </div>
      </form>
      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false)
          onRequestClose()
        }}
        title="Discard changes?"
        description="You have unsaved changes in this LLM configuration. Closing now will lose them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
      />
    </Modal>
  )
}
