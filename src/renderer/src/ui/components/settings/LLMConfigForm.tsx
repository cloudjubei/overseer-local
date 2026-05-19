import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  listLlmModels,
  extractErrorMessage,
} from 'thefactory-ui/headless/api'
import type {
  GetLlmConfigResponse,
  LlmConfigCreateInput,
  LlmConfigEditInput,
} from 'thefactory-ui/headless/api'
import { useLLMConfigs } from '@core/contexts/LLMConfigsContext'
import {
  Alert,
  Button,
  ConfirmDialog,
  Field,
  Input,
  SecretInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'thefactory-ui/web'
import { IconChat, IconRobot, IconSave } from 'thefactory-ui/web/icons'

type Provider = GetLlmConfigResponse['provider']

const PROVIDER_OPTIONS: ReadonlyArray<{ value: Provider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'llama', label: 'Llama' },
  { value: 'custom', label: 'Custom' },
]

const PROVIDERS_WITH_MODEL_LISTING = new Set<Provider>([
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'qwen',
  'llama',
  'custom',
])

const PROVIDER_FALLBACK_MODELS: Record<Provider, ReadonlyArray<string>> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3', 'o3-mini', 'o4-mini'],
  anthropic: [
    'claude-opus-4-7',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-latest',
    'claude-3-5-haiku-latest',
  ],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  xai: ['grok-2-latest', 'grok-2-mini'],
  qwen: ['qwen2.5-72b-instruct', 'qwen2.5-32b-instruct', 'qwen2.5-coder-32b-instruct'],
  llama: ['llama-3.3-70b', 'llama-3.1-70b', 'llama-3.1-8b'],
  custom: [],
}

type LLMConfigFormMode =
  | { kind: 'create'; onSubmit: (input: LlmConfigCreateInput) => Promise<unknown> }
  | {
      kind: 'edit'
      config: GetLlmConfigResponse
      onSubmit: (patch: LlmConfigEditInput) => Promise<unknown>
    }

export type LLMConfigFormProps = {
  mode: LLMConfigFormMode
  onCancel: () => void
}

export type LLMConfigFormHandle = {
  /**
   * Asks the form to close. If the form is dirty, opens a confirm-discard
   * dialog instead of calling `onCancel` directly. Wire this to the parent
   * Modal's `onClose`.
   */
  requestClose: () => void
}

const LLMConfigForm = forwardRef<LLMConfigFormHandle, LLMConfigFormProps>(function LLMConfigForm(
  { mode, onCancel },
  ref,
) {
  const initial = mode.kind === 'edit' ? mode.config : null
  const { activeChatConfigId, setActiveChat, activeAgentRunConfigId, setActiveAgentRun } =
    useLLMConfigs()
  const isChatActive = !!initial && activeChatConfigId === initial.id
  const isAgentActive = !!initial && activeAgentRunConfigId === initial.id
  const [name, setName] = useState(initial?.name ?? '')
  const [provider, setProvider] = useState<Provider>(initial?.provider ?? 'openai')
  const [model, setModel] = useState(initial?.model ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [apiUrlOverride, setApiUrlOverride] = useState(initial?.apiUrlOverride ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)

  // Tracks whether the user has actually touched a form field. Background
  // effects like the initial models load do NOT flip this — only user
  // interaction does. So opening an existing config and closing without
  // typing/clicking never triggers the discard prompt.
  const dirtyRef = useRef(false)
  const markDirty = () => {
    dirtyRef.current = true
  }

  useImperativeHandle(
    ref,
    () => ({
      requestClose: () => {
        if (dirtyRef.current) setDiscardOpen(true)
        else onCancel()
      },
    }),
    [onCancel],
  )

  const [availableModels, setAvailableModels] = useState<string[]>(() =>
    Array.from(PROVIDER_FALLBACK_MODELS[initial?.provider ?? 'openai']),
  )
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const initialIsPreset =
    !!initial && PROVIDER_FALLBACK_MODELS[initial.provider].includes(initial.model)
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>(
    PROVIDER_FALLBACK_MODELS[initial?.provider ?? 'openai'].length === 0
      ? 'custom'
      : initialIsPreset
        ? 'preset'
        : 'custom',
  )

  const providerSupportsRefresh = PROVIDERS_WITH_MODEL_LISTING.has(provider)
  const providerModels = useMemo(() => availableModels, [availableModels])

  const loadModels = async (
    p: Provider,
    key: string,
    urlOverride: string,
    currentModel: string,
    options?: { silent?: boolean },
  ) => {
    // Reconcile mode only in one direction: if we're in 'preset' but the
    // saved model is no longer in the available list, fall back to 'custom'
    // so the value is still editable. NEVER flip 'custom' → 'preset'
    // automatically — that would silently throw away the user's intent and
    // make the custom input vanish on auto-load.
    const reconcileModeForList = (list: ReadonlyArray<string>) => {
      if (currentModel && !list.includes(currentModel)) setModelMode('custom')
    }
    if (!PROVIDERS_WITH_MODEL_LISTING.has(p) || key.trim().length === 0) {
      const fallback = Array.from(PROVIDER_FALLBACK_MODELS[p])
      setAvailableModels(fallback)
      reconcileModeForList(fallback)
      setModelsError(null)
      return
    }
    setModelsLoading(true)
    setModelsError(null)
    try {
      const { data } = await listLlmModels({
        body: {
          provider: p,
          apiKey: key,
          apiUrlOverride: urlOverride.trim() || undefined,
        },
        throwOnError: true,
      })
      const names = Array.from(
        new Set(
          (data ?? [])
            .map((entry) => entry.model)
            .filter((m): m is string => typeof m === 'string' && m.trim().length > 0),
        ),
      )
      const finalList = names.length > 0 ? names : Array.from(PROVIDER_FALLBACK_MODELS[p])
      setAvailableModels(finalList)
      reconcileModeForList(finalList)
    } catch (err) {
      const fallback = Array.from(PROVIDER_FALLBACK_MODELS[p])
      setAvailableModels(fallback)
      reconcileModeForList(fallback)
      if (!options?.silent) {
        setModelsError(
          extractErrorMessage(
            err,
            'Could not fetch the latest models from this provider. Check the API key and URL override.',
          ),
        )
      }
    } finally {
      setModelsLoading(false)
    }
  }

  useEffect(() => {
    void loadModels(provider, apiKey, apiUrlOverride, model, { silent: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const canSubmit = name.trim().length > 0 && model.trim().length > 0 && apiKey.trim().length > 0

  const onProviderChange = (next: Provider) => {
    if (next === provider) return // Radix syncing — not a real user change
    markDirty()
    setProvider(next)
    setModel('')
    setModelsError(null)
    const fallback = Array.from(PROVIDER_FALLBACK_MODELS[next])
    setAvailableModels(fallback)
    setModelMode(fallback.length === 0 ? 'custom' : 'preset')
    void loadModels(next, apiKey, apiUrlOverride, '', { silent: true })
  }

  const onModelSelect = (value: string) => {
    if (value === '__custom__') {
      // Bail out if we're already in custom mode — defends against Radix
      // firing onValueChange when the controlled value prop changes from a
      // preset value to '__custom__' due to a mode reconciliation.
      if (modelMode === 'custom') return
      markDirty()
      setModelMode('custom')
      setModel('')
    } else {
      if (modelMode === 'preset' && model === value) return
      markDirty()
      setModelMode('preset')
      setModel(value)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        provider,
        model: model.trim(),
        apiKey: apiKey.trim(),
        apiUrlOverride: apiUrlOverride.trim() || undefined,
      }
      await mode.onSubmit(payload)
      onCancel()
    } catch (err) {
      setError(
        extractErrorMessage(
          err,
          'The backend rejected this LLM configuration. Double-check the provider, model, API key, and URL override.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {error && <Alert>{error}</Alert>}

      {mode.kind === 'edit' && initial && (
        <div className="flex items-center gap-2 pb-2 border-b border-(--border-subtle)">
          <Button
            type="button"
            onClick={() => setActiveAgentRun(initial.id)}
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
            onClick={() => setActiveChat(initial.id)}
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

      <Field label="Name" hint="A label you'll recognise, e.g. “Claude Sonnet (work)”">
        <Input
          value={name}
          onChange={(e) => {
            markDirty()
            setName(e.target.value)
          }}
          autoFocus
        />
      </Field>
      <Field label="Provider">
        <Select value={provider} onValueChange={(v) => onProviderChange(v as Provider)}>
          <SelectTrigger>
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="API key">
        <SecretInput
          value={apiKey}
          onChange={(e) => {
            markDirty()
            setApiKey(e.target.value)
          }}
          autoComplete="off"
          spellCheck={false}
          placeholder={provider === 'custom' ? 'Optional bearer token' : 'sk-...'}
          revealConfirmDescription="The API key will be visible until you leave this page."
        />
      </Field>
      <Field label="API URL override (optional)" hint="Only for self-hosted or proxy endpoints">
        <Input
          value={apiUrlOverride}
          onChange={(e) => {
            markDirty()
            setApiUrlOverride(e.target.value)
          }}
          placeholder="https://…"
        />
      </Field>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label className="block text-sm font-medium">Model</label>
          {providerSupportsRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadModels(provider, apiKey, apiUrlOverride, model)}
              loading={modelsLoading}
              disabled={apiKey.trim().length === 0}
            >
              {modelsLoading ? 'Loading…' : 'Refresh Models'}
            </Button>
          )}
        </div>
        {providerSupportsRefresh && apiKey.trim().length === 0 && (
          <p className="text-xs text-(--text-secondary) mb-1">
            Enter an API key above to fetch the latest list of available models from the provider.
          </p>
        )}
        {providerModels.length > 0 && (
          <Select
            value={modelMode === 'preset' && model ? model : '__custom__'}
            onValueChange={onModelSelect}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {providerModels.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Custom</SelectItem>
            </SelectContent>
          </Select>
        )}
        {modelMode === 'custom' && (
          <Input
            className={providerModels.length > 0 ? 'mt-2' : ''}
            value={model}
            onChange={(e) => {
              markDirty()
              setModel(e.target.value)
            }}
            placeholder="model-id"
          />
        )}
        {modelsError && <p className="text-sm text-red-500 mt-1">{modelsError}</p>}
      </div>

      <div className="flex justify-end pt-2">
        {mode.kind === 'create' ? (
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            Create config
          </Button>
        ) : (
          <Button
            type="submit"
            variant="secondary"
            size="icon"
            loading={submitting}
            disabled={!canSubmit}
            title="Save"
            aria-label="Save"
          >
            <IconSave className="w-4 h-4" />
          </Button>
        )}
      </div>
      <ConfirmDialog
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false)
          onCancel()
        }}
        title="Discard changes?"
        description="You have unsaved changes in this LLM configuration. Closing now will lose them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        destructive
      />
    </form>
  )
})

export default LLMConfigForm
