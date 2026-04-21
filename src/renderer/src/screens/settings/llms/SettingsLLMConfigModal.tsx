import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { Modal } from '@renderer/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/Select'
import { useToast } from '@renderer/components/ui/Toast'
import { useLLMConfig } from '@renderer/contexts/LLMConfigContext'
import { llmConfigsService } from '@renderer/services/llmConfigsService'
import React, { useEffect, useMemo, useState } from 'react'
import { LLMConfig, LLMProvider } from 'thefactory-tools'
import { DEFAULT_PROVIDER_ENDPOINTS } from 'thefactory-tools/utils'

const PROVIDERS: Array<{ value: LLMProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'custom', label: 'Custom' },
]

const PROVIDERS_WITH_MODEL_LISTING = new Set<LLMProvider>(['openai', 'anthropic', 'gemini', 'deepseek', 'custom'])

export default function SettingsLLMConfigModal({
  mode,
  id,
  onRequestClose,
}: {
  mode: 'add' | 'edit'
  id?: string
  onRequestClose: () => void
}) {
  const { configs, addConfig, updateConfig, activeChatConfigId, setActiveChat } = useLLMConfig()
  const { toast } = useToast()
  const isEdit = mode === 'edit'
  const existing = isEdit ? configs.find((c) => c.id === id) || null : null

  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('custom')
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const [form, setForm] = useState<LLMConfig>(
    () =>
      existing || {
        id: '',
        name: '',
        provider: 'openai',
        apiKey: '',
        model: '',
      },
  )

  const applyModelOptions = (models: string[], currentModel: string) => {
    const uniqueModels = Array.from(new Set(models.filter((m) => typeof m === 'string' && m.trim().length > 0)))
    setAvailableModels(uniqueModels)
    setModelMode(uniqueModels.includes(currentModel) ? 'preset' : 'custom')
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
    const next =
      existing || {
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
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === 'apiUrlOverride' && value === '' ? undefined : value,
    }))
  }

  const onProviderChange = (value: LLMProvider) => {
    const endpoint = value === 'custom' ? '' : DEFAULT_PROVIDER_ENDPOINTS[value]
    const next: LLMConfig = {
      ...form,
      provider: value,
      model: '',
      apiUrlOverride: endpoint || undefined,
    }

    setForm(next)
    setModelsError(null)
    setAvailableModels([])
    setModelMode('custom')
    void loadAvailableModels(next, { silent: true })
  }

  const handleModelSelect = (value: string) => {
    if (value === 'custom') {
      setModelMode('custom')
      setForm((prev) => ({ ...prev, model: '' }))
    } else {
      setModelMode('preset')
      setForm((prev) => ({ ...prev, model: value }))
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const needsUrlOverride = form.provider === 'custom'

    if (!form.name || !form.provider || !form.model || (needsUrlOverride && !form.apiUrlOverride)) {
      toast({
        title: 'Missing fields',
        description: needsUrlOverride
          ? 'Please provide name, provider, API URL override, and model.'
          : 'Please provide name, provider, and model.',
        variant: 'error',
      })
      return
    }

    if (isEdit) {
      updateConfig(form.id!, { ...form })
    } else {
      const { id: _omit, ...toAdd } = form
      addConfig(toAdd)
    }

    onRequestClose()
  }

  const providerSupportsRefresh = PROVIDERS_WITH_MODEL_LISTING.has(form.provider)
  const providerModels = useMemo(() => availableModels, [availableModels])
  const isChatActive = isEdit && existing ? activeChatConfigId === existing.id : false

  return (
    <Modal
      isOpen={true}
      onClose={onRequestClose}
      title={isEdit ? 'Edit LLM Configuration' : 'Add LLM Configuration'}
    >
      {isEdit && existing && (
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm">
            Chat status:{' '}
            {isChatActive ? (
              <span className="badge badge--soft badge--info">Chat Active</span>
            ) : (
              <span className="text-[var(--text-secondary)]">Not chat active</span>
            )}
          </div>
          {!isChatActive && (
            <Button variant="outline" onClick={() => setActiveChat(existing.id!)}>
              Set as Chat Active
            </Button>
          )}
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
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            placeholder={form.provider === 'custom' ? 'Optional bearer token' : 'sk-...'}
            value={form.apiKey}
            onChange={onChange}
          />
        </div>

        <div>
          <label htmlFor="apiUrlOverride" className="block text-sm font-medium mb-1">
            API URL {form.provider === 'custom' ? '' : '(optional)'}
          </label>
          <Input
            id="apiUrlOverride"
            name="apiUrlOverride"
            placeholder={form.provider === 'custom' ? 'http://localhost:1234/v1/chat/completions' : 'Optional provider endpoint override'}
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

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onRequestClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  )
}
