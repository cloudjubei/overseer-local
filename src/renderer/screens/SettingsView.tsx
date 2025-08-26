import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useLLMConfig } from '../hooks/useLLMConfig';
import type { LLMConfig } from '../types';
import { useTheme, type Theme } from '../hooks/useTheme';

export default function SettingsView() {
  const themes: Theme[] = ['light', 'dark'];
  const { theme, setTheme } = useTheme();

  const { configs, activeConfigId, addConfig, updateConfig, removeConfig, setActive } = useLLMConfig();
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('preset');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const defaultUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    grok: 'https://api.x.ai/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    litellm: '',
    custom: ''
  };

  const commonModels: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-5', 'gpt-5-nano'],
    litellm: ['gpt-4o', 'gpt-5', 'gpt-5-nano', 'claude-4-opus-20250514', 'claude-4-sonnet-20250514', 'claude-4-haiku', 'gemini/gemini-2.5-pro', 'gemini/gemini-2.5-flash', 'xai/grok-4'],
    custom: []
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingConfig((prev) => (prev ? { ...prev, [name]: value } : prev));
  };

  const handleProviderChange = (value: string) => {
    setEditingConfig((prev) => {
      if (!prev) return prev;
      const newBase = defaultUrls[value] ?? '';
      return { ...prev, provider: value, apiBaseUrl: newBase } as LLMConfig;
    });
    setModelMode('preset');
  };

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setModelMode('custom');
      setEditingConfig((prev) => (prev ? { ...prev, model: '' } : prev));
    } else {
      setModelMode('preset');
      setEditingConfig((prev) => (prev ? { ...prev, model: value } : prev));
    }
  };

  const handleSaveConfig = () => {
    if (!editingConfig) return;
    if (isAddingNew) {
      addConfig(editingConfig);
    } else {
      updateConfig(editingConfig.id, editingConfig);
    }
    setEditingConfig(null);
    setIsAddingNew(false);
    setModelMode('preset');
  };

  const handleCancelEdit = () => {
    setEditingConfig(null);
    setIsAddingNew(false);
    setModelMode('preset');
    setShowApiKey(false);
  };

  const handleEditConfig = (config: LLMConfig) => {
    setEditingConfig({ ...config });
    const providerModels = commonModels[config.provider] || [];
    setModelMode(providerModels.includes(config.model) ? 'preset' : 'custom');
    setIsAddingNew(false);
  };

  const handleAddNewConfig = () => {
    setEditingConfig({ id: '', name: '', provider: 'openai', apiBaseUrl: defaultUrls['openai'] || '', apiKey: '', model: '' });
    setIsAddingNew(true);
    setModelMode('preset');
    setShowApiKey(false);
  };

  const handleDeleteConfig = (id: string) => {
    removeConfig(id);
    if (editingConfig?.id === id) {
      setEditingConfig(null);
      setIsAddingNew(false);
    }
  };

  // Sidebar active state synced with hash
  const initialSection = useMemo(() => (typeof window !== 'undefined' && window.location.hash ? window.location.hash.slice(1) : 'appearance'), []);
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash ? window.location.hash.slice(1) : 'appearance';
      setActiveSection(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div className="settings flex flex-col min-h-0 w-full">
      <header className="settings__header">
        <h1 className="settings__title">Settings</h1>
      </header>
      <div className="settings__inner">
        <aside className="settings__sidebar">
          <nav aria-label="Settings sections">
            <ul className="settings-nav">
              <li><a href="#appearance" className={activeSection === 'appearance' ? 'is-active' : ''}>Appearance</a></li>
              <li><a href="#llm" className={activeSection === 'llm' ? 'is-active' : ''}>LLM Configuration</a></li>
            </ul>
          </nav>
        </aside>
        <main className="settings__content">
          {/* Appearance */}
          <section id="appearance" className="settings-card" aria-labelledby="appearance-title">
            <div className="settings-card__header">
              <h2 id="appearance-title" className="settings-card__title">Appearance</h2>
            </div>
            <p className="settings-card__desc">Choose a theme. Colors follow Monday-style palettes with improved contrast. You can switch anytime.</p>
            <div className="settings-form" role="form" aria-labelledby="appearance-title">
              <div>
                <label htmlFor="themeSelect">Theme</label>
                <select
                  id="themeSelect"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as Theme)}
                  className="ui-select"
                  aria-label="Theme selection"
                >
                  {themes.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* LLM Configurations */}
          <section id="llm" className="settings-card" aria-labelledby="llm-title">
            <div className="settings-card__header">
              <h2 id="llm-title" className="settings-card__title">LLM Configurations</h2>
              <div className="settings-inline">
                <Button onClick={handleAddNewConfig}>Add New</Button>
              </div>
            </div>
            <p className="settings-card__desc">Manage providers, API keys, and models. For LiteLLM, set your proxy URL and choose a model alias.</p>

            <div className="config-list" role="list">
              {configs.length === 0 && (
                <div className="config-item" role="listitem">
                  <div className="config-item__meta">
                    <div className="config-item__name">No configurations yet</div>
                    <div className="config-item__sub">Create one to start chatting with your preferred models.</div>
                  </div>
                  <div className="config-actions">
                    <Button onClick={handleAddNewConfig}>Create</Button>
                  </div>
                </div>
              )}
              {configs.map((cfg) => (
                <div key={cfg.id} className="config-item" role="listitem">
                  <div className="config-item__meta">
                    <div className="config-item__name">
                      {cfg.name} {activeConfigId === cfg.id && <span className="pill-active" aria-label="Active configuration">Active</span>}
                    </div>
                    <div className="config-item__sub">{cfg.provider || 'custom'} · {cfg.model || 'no model'}</div>
                  </div>
                  <div className="config-actions">
                    <Button onClick={() => handleEditConfig(cfg)} variant="outline">Edit</Button>
                    <Button onClick={() => handleDeleteConfig(cfg.id)} variant="destructive">Delete</Button>
                    {activeConfigId !== cfg.id && <Button onClick={() => setActive(cfg.id)}>Set Active</Button>}
                  </div>
                </div>
              ))}
            </div>

            {editingConfig && (
              <div className="settings-card" style={{ marginTop: 12 }}>
                <h3 className="settings-card__title">{isAddingNew ? 'Add Configuration' : 'Edit Configuration'}</h3>
                <div className="settings-form settings-form--2col" role="form" aria-label="LLM configuration form">
                  <div>
                    <label htmlFor="name">Name</label>
                    <Input id="name" placeholder="Name" name="name" value={editingConfig.name || ''} onChange={handleConfigChange} />
                  </div>

                  <div>
                    <label htmlFor="provider">Provider</label>
                    <Select value={editingConfig.provider || 'openai'} onValueChange={handleProviderChange}>
                      <SelectTrigger id="provider">
                        <SelectValue placeholder="Provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="litellm">LiteLLM</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <label htmlFor="apiBaseUrl">API Base URL</label>
                    <Input id="apiBaseUrl" placeholder="https://..." name="apiBaseUrl" value={editingConfig.apiBaseUrl || ''} onChange={handleConfigChange} />
                  </div>

                  <div>
                    <label htmlFor="apiKey">API Key</label>
                    <div className="settings-inline">
                      <Input id="apiKey" placeholder="••••••••" name="apiKey" value={editingConfig.apiKey || ''} onChange={handleConfigChange} type={showApiKey ? 'text' : 'password'} />
                      <Button variant="outline" onClick={() => setShowApiKey((s) => !s)} aria-pressed={showApiKey} aria-label={showApiKey ? 'Hide API key' : 'Show API key'}>
                        {showApiKey ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="model">Model</label>
                    {editingConfig.provider !== 'custom' && commonModels[editingConfig.provider]?.length > 0 ? (
                      <Select value={modelMode === 'preset' ? editingConfig.model : 'custom'} onValueChange={handleModelChange}>
                        <SelectTrigger id="model">
                          <SelectValue placeholder="Select Model" />
                        </SelectTrigger>
                        <SelectContent>
                          {commonModels[editingConfig.provider].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input id="model" placeholder="Model ID (e.g., claude-3-5-sonnet)" name="model" value={editingConfig.model || ''} onChange={handleConfigChange} />
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <Button variant="outline" onClick={handleCancelEdit}>Cancel</Button>
                  <Button onClick={handleSaveConfig}>Save</Button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
