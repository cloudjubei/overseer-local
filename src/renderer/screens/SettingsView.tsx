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

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingConfig((prev) => prev ? { ...prev, [name]: value } : null);
  };

  const handleProviderChange = (value: string) => {
    setEditingConfig((prev) => prev ? { ...prev, provider: value as 'openai' | 'litellm' } : null);
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
  };

  const handleEditConfig = (config: LLMConfig) => {
    setEditingConfig({ ...config });
    setIsAddingNew(false);
  };

  const handleAddNewConfig = () => {
    setEditingConfig({ id: '', name: '', provider: 'openai', apiBaseUrl: '', apiKey: '', model: '' });
    setIsAddingNew(true);
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
            <Input
              placeholder="Name"
              name="name"
              value={editingConfig.name || ''}
              onChange={handleConfigChange}
              className="mb-2"
            />
            <Select value={editingConfig.provider || 'openai'} onValueChange={handleProviderChange}>
              <SelectTrigger className="mb-2">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="litellm">LiteLLM</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="API Base URL"
              name="apiBaseUrl"
              value={editingConfig.apiBaseUrl || ''}
              onChange={handleConfigChange}
              className="mb-2"
            />
            <Input
              placeholder="API Key"
              name="apiKey"
              value={editingConfig.apiKey || ''}
              onChange={handleConfigChange}
              className="mb-2"
            />
            <Input
              placeholder="Model"
              name="model"
              value={editingConfig.model || ''}
              onChange={handleConfigChange}
              className="mb-2"
            />
            <Button onClick={handleSaveConfig}>Save</Button>
          </div>
        )}
      </section>
    </div>
  );
}
