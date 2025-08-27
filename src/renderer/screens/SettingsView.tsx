import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { notificationsService } from '../services/notificationsService';
import { chatService } from '../services/chatService';
import type { LLMConfig } from '../types';
import { useTheme, type Theme } from '../hooks/useTheme';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual' },
  { id: 'llms', label: 'LLMs' },
  { id: 'notifications', label: 'Notifications' }
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

export default function SettingsView() {
  const themes: Theme[] = ['light', 'dark'];
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useNotificationPreferences();

  const { configs, activeConfigId, addConfig, updateConfig, removeConfig, setActive } = useLLMConfig();
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('preset');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const { toast } = useToast();

  // Layout state
  const [categoryCollapsed, setCategoryCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId>('visual');

  // Defaults and common models
  const defaultUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    grok: 'https://api.x.ai/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    local: 'http://localhost:1234/v1',
    custom: ''
  };

  const commonModels: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-5', 'gpt-5-nano'],
    anthropic: ['claude-4-opus-20250514', 'claude-4-sonnet-20250514', 'claude-4-haiku'],
    grok: ['xai/grok-4'],
    gemini: ['gemini/gemini-2.5-pro', 'gemini/gemini-2.5-flash'],
    custom: []
  };

  const providerModels = useMemo(() => {
    if (!editingConfig) return [] as string[];
    if (modelMode === 'custom') return availableModels;
    return []
    // return commonModels[editingConfig.provider] || [];
  }, [editingConfig, availableModels]);

  function resetEditingState() {
    setEditingConfig(null);
    setIsAddingNew(false);
    setModelMode('preset');
    setAvailableModels([]);
    setModelsError(null);
  }

  // Handlers: LLM Config editing
  const handleConfigFieldChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingConfig((prev) => (prev ? { ...prev, [name]: value } : null));
    if (name === 'apiBaseUrl' && modelMode === 'custom') {
      setAvailableModels([]);
      setModelsError(null);
    }
  };

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setModelMode('custom');
      setEditingConfig((prev) => (prev ? { ...prev, model: '' } : null));
    } else {
      setModelMode('preset');
      setEditingConfig((prev) => (prev ? { ...prev, model: value } : null));
    }
  };

  const loadModels = async () => {
    if (!editingConfig) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await chatService.listModels(editingConfig);
      setAvailableModels(models);
      setModelsError(null);
    } catch (err) {
      setModelsError('Failed to load models. Is your provider endpoint running?');
      setAvailableModels([]);
      toast({ title: 'Error', description: String(err), variant: 'error' });
    } finally {
      setModelsLoading(false);
    }
  };

  const openEditModal = (config: LLMConfig) => {
    setEditingConfig({ ...config });
    const pModels = commonModels[config.provider] || [];
    setModelMode(pModels.includes(config.model) ? 'preset' : 'custom');
    setIsAddingNew(false);
    setAvailableModels(pModels);
    setModelsError(null);
  };

  const openAddModal = () => {
    setEditingConfig({ id: '', name: '', apiBaseUrl: '', apiKey: '', model: '' });
    setIsAddingNew(true);
    setModelMode('custom');
    setAvailableModels(commonModels['openai'] || []);
    setModelsError(null);
  };

  const handleSaveConfig = () => {
    if (!editingConfig) return;
    if (!editingConfig.name || !editingConfig.provider || !editingConfig.model) {
      toast({ title: 'Missing fields', description: 'Please provide name, provider, and model.', variant: 'error' });
      return;
    }
    if (isAddingNew) {
      addConfig(editingConfig);
    } else {
      updateConfig(editingConfig.id, editingConfig);
    }
    resetEditingState();
  };

  const handleDeleteConfig = (id: string) => {
    removeConfig(id);
    if (editingConfig?.id === id) resetEditingState();
  };

  // Visual Settings content
  const renderVisualSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Appearance</h2>
      <div className="space-y-2">
        <label htmlFor="theme" className="block text-sm font-medium">Theme</label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => {
            const t = e.target.value as Theme;
            setTheme(t);
            try { localStorage.setItem('theme', t); } catch {}
          }}
          className="w-64 p-2 border border-gray-300 rounded-md focus:border-brand-600 focus:ring-1 focus:ring-brand-600"
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  // LLMs list content
  const renderLLMsSection = () => (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">LLM Configurations</h2>
        <Button onClick={openAddModal}>Add New Config</Button>
      </div>
      <div className="border rounded-md divide-y">
        {configs.length === 0 && (
          <div className="p-4 text-sm text-gray-600">No configurations yet. Click "Add New Config" to create one.</div>
        )}
        {configs.map((cfg) => (
          <div key={cfg.id} className="p-3 flex flex-wrap gap-2 md:flex-nowrap md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{cfg.name} {activeConfigId === cfg.id ? <span className="ml-2 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border-default)' }}>Active</span> : null}</div>
              <div className="text-sm text-gray-600 truncate">
                Provider: {cfg.provider} • Model: {cfg.model || '—'}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={() => openEditModal(cfg)} variant="outline">Edit</Button>
              <Button onClick={() => handleDeleteConfig(cfg.id)} variant="danger">Delete</Button>
              {activeConfigId !== cfg.id && (
                <Button onClick={() => setActive(cfg.id)}>Set Active</Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] mt-2">
        Tip: For LiteLLM provider, set API Base URL to your LiteLLM proxy (e.g., http://localhost:4000). This enables non-OpenAI models like claude or grok using a single OpenAI-compatible interface.
      </div>
    </div>
  );
  const renderNotificationsSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Notification Preferences</h2>
      <div className="space-y-4">
        <Switch
          checked={preferences.osNotificationsEnabled}
          onCheckedChange={async (checked) => {
            const success = await notificationsService.changeNotifications(checked)
            if (success){
              updatePreferences({ osNotificationsEnabled: true });
            }else{
              updatePreferences({ osNotificationsEnabled: false });
            }
          }}
          label="Enable OS Notifications"
        />
        <div>
          <h3 className="font-medium mb-2">Notification Categories</h3>
          <div className="space-y-2">
            {Object.entries(preferences.categoriesEnabled).map(([category, enabled]) => (
              <Switch
                key={category}
                checked={enabled ?? true}
                onCheckedChange={(checked) => updatePreferences({ categoriesEnabled: { [category]: checked } })}
                label={category.charAt(0).toUpperCase() + category.slice(1)}
              />
            ))}
          </div>
        </div>
        <Switch
          checked={preferences.soundsEnabled}
          onCheckedChange={(checked) => updatePreferences({ soundsEnabled: checked })}
          label="Enable Notification Sounds"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Notification Display Duration</label>
          <Select
            value={preferences.displayDuration.toString()}
            onValueChange={(value) => updatePreferences({ displayDuration: parseInt(value) })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 seconds</SelectItem>
              <SelectItem value="5">5 seconds</SelectItem>
              <SelectItem value="10">10 seconds</SelectItem>
              <SelectItem value="0">Persistent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  // LLM Config Modal content
  const renderConfigModal = () => {
    if (!editingConfig) return null;

    const modalTitle = isAddingNew ? 'Add LLM Configuration' : 'Edit LLM Configuration';

    const onClose = () => {
      resetEditingState();
    };

    const onSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleSaveConfig();
    };

    return (
      <Modal title={modalTitle} onClose={onClose} isOpen={true}>
        <form className="space-y-3" onSubmit={onSubmit} onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSaveConfig();
          }
        }}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <Input id="name" placeholder="Name" name="name" value={editingConfig.name || ''} onChange={handleConfigFieldChange} />
          </div>

          <div>
            <label htmlFor="provider" className="block text-sm font-medium mb-1">Provider</label>
            <Select value={editingConfig.provider || 'openai'} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="litellm">LiteLLM</SelectItem>
                <SelectItem value="lmstudio">LM Studio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="apiBaseUrl" className="block text-sm font-medium mb-1">API Base URL</label>
            <Input id="apiBaseUrl" placeholder="https://..." name="apiBaseUrl" value={editingConfig.apiBaseUrl || ''} onChange={handleConfigFieldChange} />
          </div>

          <div>
            <label htmlFor="apiKey" className="block textsm font-medium mb-1">API Key</label>
            <Input id="apiKey" placeholder="sk-..." name="apiKey" value={editingConfig.apiKey || ''} onChange={handleConfigFieldChange} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="model" className="block text-sm font-medium mb-1">Model</label>
              {editingConfig.provider === 'lmstudio' && (
                <Button type="button" onClick={loadModels} disabled={modelsLoading} variant="outline" className="ml-2">
                  {modelsLoading ? 'Loading…' : 'Load Available Models'}
                </Button>
              )}
            </div>

            {(editingConfig.provider !== 'custom' && providerModels.length > 0) ? (
              <Select value={modelMode === 'preset' ? editingConfig.model : 'custom'} onValueChange={handleModelChange}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {providerModels.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            {(modelMode === 'custom' || providerModels.length === 0) && (
              <Input placeholder="Custom model id" name="model" value={editingConfig.model || ''} onChange={handleConfigFieldChange} className="mt-2" />
            )}

            {modelsError && <p className="text-red-500 text-sm mt-1">{modelsError}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    );
  };

  return (
    <div className="flex flex-col min-h-0 w-full">
      <header className="shrink-0 px-4 py-3 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">Settings</h1>
        <Button variant="secondary" onClick={() => setCategoryCollapsed((c) => !c)}>
          {categoryCollapsed ? 'Show Categories' : 'Hide Categories'}
        </Button>
      </header>

      <div className="flex min-h-0 w-full">
        {/* Categories Pane (collapsible) */}
        <aside className={`${categoryCollapsed ? 'hidden' : 'block'} w-64 shrink-0 border-r overflow-y-auto`}>
          <nav className="p-2">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors ${active ? 'bg-[var(--surface-raised)] border border-[var(--border-default)]' : 'hover:bg-[var(--surface-raised)]'}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 overflow-auto p-4">
          {activeCategory === 'visual' && renderVisualSection()}
          {activeCategory === 'llms' && renderLLMsSection()}
          {activeCategory === 'notifications' && renderNotificationsSection()}
        </main>
      </div>

      {renderConfigModal()}
    </div>
  );
}
