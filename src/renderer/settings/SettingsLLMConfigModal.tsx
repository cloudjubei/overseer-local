import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { chatService } from '../services/chatService';
import type { LLMConfig, LLMProviderType } from '../types';
import { useToast } from '../components/ui/Toast';

const PROVIDER_DEFAULT_URL: Record<LLMProviderType, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  xai: 'https://api.x.ai/v1',
  local: 'http://localhost:1234/v1',
  custom: '',
};

const PROVIDER_MODELS: Record<Exclude<LLMProviderType, 'local' | 'custom'>, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
  ],
  anthropic: [
    'claude-3-5-sonnet-20240620',
    'claude-3-opus-20240229',
    'claude-3-haiku-20240307',
  ],
  gemini: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
  xai: [
    'grok-1.5',
    'grok-1',
  ],
};

export default function SettingsLLMConfigModal({ mode, id, onRequestClose }: { mode: 'add' | 'edit', id?: string, onRequestClose: () => void }) {
  const { configs, addConfig, updateConfig } = useLLMConfig();
  const { toast } = useToast();
  const isEdit = mode === 'edit';
  const existing = isEdit ? configs.find(c => c.id === id) || null : null;

  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('preset');
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const [form, setForm] = useState<LLMConfig>(() => existing || {
    id: '',
    name: '',
    provider: 'openai',
    apiBaseUrl: PROVIDER_DEFAULT_URL.openai,
    apiKey: '',
    model: '',
  });

  useEffect(() => {
    if (existing) {
      setForm(existing);
      const presets = existing.provider === 'local' || existing.provider === 'custom' ? [] : (PROVIDER_MODELS[existing.provider as keyof typeof PROVIDER_MODELS] || []);
      setAvailableModels(presets);
      setModelMode(presets.includes(existing.model) ? 'preset' : 'custom');
    }
  }, [existing]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const onProviderChange = (value: LLMProviderType) => {
    setForm(prev => ({
      ...prev,
      provider: value,
      apiBaseUrl: PROVIDER_DEFAULT_URL[value] ?? prev.apiBaseUrl,
      // reset model when provider changes
      model: '',
    }));
    setModelsError(null);
    if (value === 'local') {
      setAvailableModels([]);
      setModelMode('custom');
    } else if (value === 'custom') {
      setAvailableModels([]);
      setModelMode('custom');
    } else {
      const presets = PROVIDER_MODELS[value as keyof typeof PROVIDER_MODELS] || [];
      setAvailableModels(presets);
      setModelMode('preset');
    }
  };

  const handleModelSelect = (value: string) => {
    if (value === 'custom') {
      setModelMode('custom');
      setForm(prev => ({ ...prev, model: '' }));
    } else {
      setModelMode('preset');
      setForm(prev => ({ ...prev, model: value }));
    }
  };

  const loadLocalModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await chatService.listModels(form);
      setAvailableModels(models);
      if (!models.includes(form.model)) {
        setForm(prev => ({ ...prev, model: '' }));
      }
    } catch (e) {
      setModelsError('Failed to load models from local provider. Is it running?');
      toast({ title: 'Failed to load models', description: String(e), variant: 'error' });
    } finally {
      setModelsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.provider || !form.apiBaseUrl || !form.model) {
      toast({ title: 'Missing fields', description: 'Please provide name, provider, API URL, and model.', variant: 'error' });
      return;
    }
    if (isEdit) {
      updateConfig(form.id, { ...form });
    } else {
      const { id: _omit, ...toAdd } = form;
      addConfig(toAdd);
    }
    onRequestClose();
  };

  const providerModels = useMemo(() => {
    if (form.provider === 'local' || form.provider === 'custom') return availableModels;
    return availableModels;
  }, [form.provider, availableModels]);

  return (
    <Modal isOpen={true} onClose={onRequestClose} title={isEdit ? 'Edit LLM Configuration' : 'Add LLM Configuration'}>
      <form className="space-y-3" onSubmit={onSubmit}>
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
          <Input id="name" name="name" placeholder="My Provider" value={form.name} onChange={onChange} />
        </div>

        <div>
          <label htmlFor="provider" className="block text-sm font-medium mb-1">Provider</label>
          <Select value={form.provider} onValueChange={(v) => onProviderChange(v as LLMProviderType)}>
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
          <label htmlFor="apiBaseUrl" className="block text-sm font-medium mb-1">API Base URL</label>
          <Input id="apiBaseUrl" name="apiBaseUrl" placeholder="https://..." value={form.apiBaseUrl} onChange={onChange} />
        </div>

        <div>
          <label htmlFor="apiKey" className="block textsm font-medium mb-1">API Key</label>
          <Input id="apiKey" name="apiKey" placeholder="sk-..." value={form.apiKey} onChange={onChange} />
          <p className="text-[12px] text-[var(--text-secondary)] mt-1">Some local providers may not require an API key.</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="model" className="block text-sm font-medium mb-1">Model</label>
            {form.provider === 'local' && (
              <Button type="button" onClick={loadLocalModels} disabled={modelsLoading} variant="outline">
                {modelsLoading ? 'Loading…' : 'Load Available Models'}
              </Button>
            )}
          </div>

          {providerModels.length > 0 && (
            <Select value={modelMode === 'preset' ? form.model : 'custom'} onValueChange={handleModelSelect}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {providerModels.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          )}

          {(modelMode === 'custom' || providerModels.length === 0) && (
            <Input className="mt-2" name="model" placeholder="model-id" value={form.model} onChange={onChange} />
          )}

          {modelsError && <p className="text-red-500 text-sm mt-1">{modelsError}</p>}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onRequestClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}
