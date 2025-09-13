import React, { useEffect, useMemo, useState } from 'react'
import { Modal } from '../renderer/components/ui/Modal'
import { Input } from '../renderer/components/ui/Input'
import { Button } from '../renderer/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../renderer/components/ui/Select'
import { useLLMConfig } from '../renderer/contexts/LLMConfigContext'
import { chatsService, LLMProviderType } from '../renderer/services/chatsService'
import { useToast } from '../renderer/components/ui/Toast'
import { LLMConfig } from 'thefactory-tools'

const PROVIDER_DEFAULT_URL: Record<LLMProviderType, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
  local: 'http://localhost:1234/v1/chat/completions',
  custom: '',
}

const PROVIDER_MODELS: Record<Exclude<LLMProviderType, 'local' | 'custom'>, string[]> = {
  openai: ['gpt-5', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-4.1-opus', 'claude-opus-4'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  xai: ['grok-4'],
}

export default function SettingsLLMConfigModal({
  mode,
  id,
  onRequestClose,
}: {
  mode: 'add' | 'edit'
  id?: string
  onRequestClose: () => void
}) {
  const { configs, addConfig, updateConfig } = useLLMConfig()
  const { toast } = useToast()
  const isEdit = mode === 'edit'
  const existing = isEdit ? configs.find((c) => c.id === id) || null : null

  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('preset')
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const [form, setForm] = useState<LLMConfig>(
    () =>
      existing || {
        id: '',
        name: '',
        provider: 'openai',
        apiBaseUrl: PROVIDER_DEFAULT_URL.openai,
        apiKey: '',
        model: '',
      },
  )

  useEffect(() => {
    if (existing) {
      setForm(existing)
      const presets =
        existing.provider === 'local' || existing.provider === 'custom'
          ? []
          : PROVIDER_MODELS[existing.provider as keyof typeof PROVIDER_MODELS] || []
      setAvailableModels(presets)
      setModelMode(presets.includes(existing.model) ? 'preset' : 'custom')
    }
  }, [existing])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onProviderChange = (value: LLMProviderType) => {
    setForm((prev) => ({
      ...prev,
      provider: value,
      apiBaseUrl: PROVIDER_DEFAULT_URL[value] ?? prev.apiBaseUrl,
      // reset model when provider changes
      model: '',
    }))
    setModelsError(null)
    if (value === 'local') {
      setAvailableModels([])
      setModelMode('custom')
    } else if (value === 'custom') {
      setAvailableModels([])
      setModelMode('custom')
    } else {
      const presets = PROVIDER_MODELS[value as keyof typeof PROVIDER_MODELS] || []
      setAvailableModels(presets)
      setModelMode('preset')
    }
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

  const loadLocalModels = async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const models = await chatsService.listModels(form)
      setAvailableModels(models)
      if (!models.includes(form.model)) {
        setForm((prev) => ({ ...prev, model: '' }))
      }
    } catch (e) {
      setModelsError('Failed to load models from local provider. Is it running?')
      toast({ title: 'Failed to load models', description: String(e), variant: 'error' })
    } finally {
      setModelsLoading(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.provider || !form.apiBaseUrl || !form.model) {
      toast({
        title: 'Missing fields',
        description: 'Please provide name, provider, API URL, and model.',
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

  const providerModels = useMemo(() => {
    if (form.provider === 'local' || form.provider === 'custom') return availableModels
    return availableModels
  }, [form.provider, availableModels])

  return (
    <Modal
      isOpen={true}
      onClose={onRequestClose}
      title={isEdit ? 'Edit LLM Configuration' : 'Add LLM Configuration'}
    >
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
          <Select
            value={form.provider}
            onValueChange={(v) => onProviderChange(v as LLMProviderType)}
          >
            <SelectTrigger id="provider">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="xai">xAI (Grok)</SelectItem>
              <SelectItem value="local">Local (OpenAI-compatible)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label htmlFor="apiBaseUrl" className="block text-sm font-medium mb-1">
            API Base URL
          </label>
          <Input
            id="apiBaseUrl"
            name="apiBaseUrl"
            placeholder="https://..."
            value={form.apiBaseUrl}
            onChange={onChange}
          />
        </div>

        <div>
          <label htmlFor="apiKey" className="block textsm font-medium mb-1">
            API Key
          </label>
          <Input
            id="apiKey"
            name="apiKey"
            placeholder="sk-..."
            value={form.apiKey}
            onChange={onChange}
          />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
            Some local providers may not require an API key.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="model" className="block text-sm font-medium mb-1">
              Model
            </label>
            {form.provider === 'local' && (
              <Button
                type="button"
                onClick={loadLocalModels}
                disabled={modelsLoading}
                variant="outline"
              >
                {modelsLoading ? 'Loading…' : 'Load Available Models'}
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
