import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { useNotificationPreferences } from '../hooks/useNotificationPreferences';
import { notificationsService } from '../services/notificationsService';
import { chatService } from '../services/chatService';
import type { LLMConfig, LLMProviderType } from '../types';
import { useTheme, type Theme } from '../hooks/useTheme';
import { useToast } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar';
import { useNavigator } from '../navigation/Navigator';

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual', icon: <span aria-hidden>🎨</span>, accent: 'purple' },
  { id: 'llms', label: 'LLMs', icon: <span aria-hidden>🤖</span>, accent: 'teal' },
  { id: 'notifications', label: 'Notifications', icon: <span aria-hidden>🔔</span>, accent: 'brand' }
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

export default function SettingsView() {
  const themes: Theme[] = ['light', 'dark'];
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences } = useNotificationPreferences();

  const { configs, activeConfigId, removeConfig, setActive } = useLLMConfig();
  const { openModal } = useNavigator();

  // Layout state
  const [activeCategory, setActiveCategory] = useState<CategoryId>('visual');

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
        <Button onClick={() => openModal({ type: 'llm-config-add' })}>Add New Config</Button>
      </div>
      <div className="border rounded-md divide-y">
        {configs.length === 0 && (
          <div className="p-4 text-sm text-gray-600">No configurations yet. Click \"Add New Config\" to create one.</div>
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
              <Button onClick={() => openModal({ type: 'llm-config-edit', id: cfg.id })} variant="outline">Edit</Button>
              <Button onClick={() => removeConfig(cfg.id)} variant="danger">Delete</Button>
              {activeConfigId !== cfg.id && (
                <Button onClick={() => setActive(cfg.id)}>Set Active</Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-[12px] text-[var(--text-secondary)] mt-2">
        Tip: Local providers must expose an OpenAI-compatible API. Use the Local preset to fill the default URL (http://localhost:1234/v1) and click \"Load Available Models\" to discover models.
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

  return (
    <CollapsibleSidebar
      items={CATEGORIES}
      activeId={activeCategory}
      onSelect={(c) => { setActiveCategory(c as CategoryId)}}
      storageKey="settings-panel-collapsed"
      headerTitle="Categories"
      headerSubtitle=""
    >
      {activeCategory === 'visual' && renderVisualSection()}
      {activeCategory === 'llms' && renderLLMsSection()}
      {activeCategory === 'notifications' && renderNotificationsSection()}
    </CollapsibleSidebar>
  );
}
