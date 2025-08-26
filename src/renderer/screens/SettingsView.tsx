import React, { useState } from 'react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { useLLMConfig } from '../hooks/useLLMConfig';
import type { LLMConfig } from '../types';

export default function SettingsView() {
  const themes = ['light', 'dark', 'blue'];

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.className = `theme-${saved}`;
    return saved;
  });
  const { configs, activeConfigId, addConfig, updateConfig, removeConfig, setActive } = useLLMConfig();
  const [editingConfig, setEditingConfig] = useState<LLMConfig | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [modelMode, setModelMode] = useState<'preset' | 'custom'>('preset');

  const defaultUrls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    grok: 'https://api.x.ai/v1',
    gemini: 'https://generativelanguage.googleapis.com/v1beta',
    custom: ''
  };

  const commonModels: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-5', 'gpt-5-nano', 'claude-4-opus-20250514', 'claude-4-sonnet-20250514', 'claude-4-haiku', 'gemini/gemini-2.5-pro', 'gemini/gemini-2.5-flash', 'xai/grok-4'],
    litellm: ['gpt-4o', 'gpt-5', 'gpt-5-nano', 'claude-4-opus-20250514', 'claude-4-sonnet-20250514', 'claude-4-haiku', 'gemini/gemini-2.5-pro', 'gemini/gemini-2.5-flash', 'xai/grok-4'],
    custom: []
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingConfig((prev) => prev ? { ...prev, [name]: value } : null);
  };

  const handleProviderChange = (value: string) => {
    setEditingConfig((prev) => {
      if (!prev) return null;
      const newBase = prev.apiBaseUrl || defaultUrls[value] || '';
      return { ...prev, provider: value, apiBaseUrl: newBase };
    });
    setModelMode('preset');
  };

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setModelMode('custom');
      setEditingConfig((prev) => prev ? { ...prev, model: '' } : null);
    } else {
      setModelMode('preset');
      setEditingConfig((prev) => prev ? { ...prev, model: value } : null);
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

  const handleEditConfig = (config: LLMConfig) => {
    setEditingConfig({ ...config });
    const providerModels = commonModels[config.provider] || [];
    setModelMode(providerModels.includes(config.model) ? 'preset' : 'custom');
    setIsAddingNew(false);
  };

  const handleAddNewConfig = () => {
    setEditingConfig({ id: '', name: '', provider: '', apiBaseUrl: '', apiKey: '', model: '' });
    setIsAddingNew(true);
    setModelMode('preset');
  };

  const handleDeleteConfig = (id: string) => {
    removeConfig(id);
    if (editingConfig?.id === id) {
      setEditingConfig(null);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Theme</h2>
        <select 
          value={theme} 
          onChange={(e) => {
            setTheme(e.target.value);
            document.documentElement.className = `theme-${e.target.value}`;
            localStorage.setItem('theme', e.target.value);
          }} 
          className="w-full p-2 border border-gray-300 rounded-md focus:border-primary focus:ring-primary"
        >
          {themes.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">LLM Configurations</h2>
        <Button onClick={handleAddNewConfig} className="mb-4">Add New Config</Button>
        {configs.map((cfg) => (
          <div key={cfg.id} className="mb-2 flex justify-between items-center p-2 border-b">
            <span>{cfg.name} ({cfg.model}) {activeConfigId === cfg.id ? '(Active)' : ''}</span>
            <div>
              <Button onClick={() => handleEditConfig(cfg)} variant="outline" className="mr-2">Edit</Button>
              <Button onClick={() => handleDeleteConfig(cfg.id)} variant="destructive" className="mr-2">Delete</Button>
              {activeConfigId !== cfg.id && <Button onClick={() => setActive(cfg.id)}>Set Active</Button>}
            </div>
          </div>
        ))}
        {editingConfig && (
          <div className="mt-4 p-4 border rounded-md">
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
            <Input id="name" placeholder="Name" name="name" value={editingConfig.name || ''} onChange={handleConfigChange} className="mb-2" />
            <label htmlFor="provider" className="block text-sm font-medium mb-1">Provider</label>
            <Select value={editingConfig.provider || 'openai'} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider" className="mb-2">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="litellm">LiteLLM</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>

            <label htmlFor="apiBaseUrl" className="block text-sm font-medium mb-1">API Base URL</label>
            <Input id="apiBaseUrl" placeholder="API Base URL" name="apiBaseUrl" value={editingConfig.apiBaseUrl || ''} onChange={handleConfigChange} className="mb-2" />
            <label htmlFor="apiKey" className="block text-sm font-medium mb-1">API Key</label>
            <Input id="apiKey" placeholder="API Key" name="apiKey" value={editingConfig.apiKey || ''} onChange={handleConfigChange} className="mb-2" />
            <label htmlFor="model" className="block text-sm font-medium mb-1">Model</label>
            {editingConfig.provider !== 'custom' && commonModels[editingConfig.provider]?.length > 0 ? (
              <Select value={modelMode === 'preset' ? editingConfig.model : 'custom'} onValueChange={handleModelChange}>
                <SelectTrigger id="model" className="mb-2">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {commonModels[editingConfig.provider].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            ) : null}
            {modelMode === 'custom' || editingConfig.provider === 'custom' ? (
              <Input placeholder="Custom Model" name="model" value={editingConfig.model || ''} onChange={handleConfigChange} className="mb-2" />
            ) : null}
            <Button onClick={handleSaveConfig}>Save</Button>
          </div>
        )}
      </section>
    </div>
  );
}
