import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import { useLLMConfig } from '../hooks/useLLMConfig';
import { useTheme, type Theme } from '../hooks/useTheme';
import CollapsibleSidebar from '../components/ui/CollapsibleSidebar';
import { useNavigator } from '../navigation/Navigator';
import { useAppSettings } from '../hooks/useAppSettings';
import { useProjectSettings } from '../hooks/useProjectSettings';
import { useNotifications } from '../hooks/useNotifications';
import { useAgents } from '../hooks/useAgents';

// Settings Categories
const CATEGORIES = [
  { id: 'visual', label: 'Visual', icon: <span aria-hidden>🎨</span>, accent: 'purple' },
  { id: 'llms', label: 'LLMs', icon: <span aria-hidden>🤖</span>, accent: 'teal' },
  { id: 'agents', label: 'All Agents', icon: <span aria-hidden>🗂️</span>, accent: 'teal' },
  { id: 'notifications', label: 'Notifications', icon: <span aria-hidden>🔔</span>, accent: 'brand' }
];

type CategoryId = typeof CATEGORIES[number]['id'];

function formatUSD(n?: number) {
  if (n == null) return '—';
  return `$${n.toFixed(4)}`;
}

function formatTs(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function SettingsView() {
  const themes: Theme[] = ['light', 'dark'];
  const { theme, setTheme } = useTheme();
  const { isAppSettingsLoaded, appSettings, updateAppSettings, setNotificationSystemSettings } = useAppSettings()
  const { projectSettings, updateProjectSettings, setNotificationProjectSettings } = useProjectSettings()
  const { enableNotifications } = useNotifications()

  const { configs, activeConfigId, removeConfig, setActive } = useLLMConfig();
  const { openModal } = useNavigator();

  const { runs, activeRuns } = useAgents();

  // Layout state
  const [activeCategory, setActiveCategory] = useState<CategoryId>('visual');

  // Aggregations for All Agents tab
  const agentsSummary = useMemo(() => {
    const totalRuns = runs.length;
    const active = activeRuns.length;
    const totals = runs.reduce((acc, r) => {
      acc.cost += r.costUSD ?? 0;
      acc.prompt += r.promptTokens ?? 0;
      acc.completion += r.completionTokens ?? 0;
      return acc;
    }, { cost: 0, prompt: 0, completion: 0 });

    const byModel = new Map<string, { model: string; provider: string; count: number; cost: number; prompt: number; completion: number; lastUpdated?: string }>();
    for (const r of runs) {
      const model = r.model ?? 'unknown';
      const provider = r.provider ?? 'unknown';
      const key = `${provider}::${model}`;
      const cur = byModel.get(key) ?? { model, provider, count: 0, cost: 0, prompt: 0, completion: 0, lastUpdated: undefined };
      cur.count += 1;
      cur.cost += r.costUSD ?? 0;
      cur.prompt += r.promptTokens ?? 0;
      cur.completion += r.completionTokens ?? 0;
      if (!cur.lastUpdated || (r.updatedAt && r.updatedAt > cur.lastUpdated)) cur.lastUpdated = r.updatedAt;
      byModel.set(key, cur);
    }

    const modelRows = Array.from(byModel.values()).map(m => ({
      ...m,
      avgCost: m.count ? m.cost / m.count : 0,
    })).sort((a, b) => b.cost - a.cost);

    return { totalRuns, active, totals, modelRows };
  }, [runs, activeRuns]);

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
        Tip: Local providers must expose an OpenAI-compatible API. Use the Local preset to fill the default URL (http://localhost:1234/v1) and click "Load Available Models" to discover models.
      </div>
    </div>
  );

  const renderNotificationsSection = () => (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-3">Notification Preferences</h2>
      <div className="space-y-4">
        <Switch
          checked={appSettings.notificationSystemSettings.osNotificationsEnabled}
          onCheckedChange={async (checked) => {
            if (checked){
              const success = await enableNotifications()
              if (success){
                setNotificationSystemSettings({ osNotificationsEnabled: true });
              }else{
                setNotificationSystemSettings({ osNotificationsEnabled: false });
              }
            }else{
                setNotificationSystemSettings({ osNotificationsEnabled: false });
            }
          }}
          label="Enable OS Notifications"
        />
        <div>
          <h3 className="font-medium mb-2">Notification Categories</h3>
          <div className="space-y-2">
            {Object.entries(projectSettings.notifications.categoriesEnabled).map(([category, enabled]) => (
              <Switch
                key={category}
                checked={enabled ?? true}
                onCheckedChange={(checked) => setNotificationProjectSettings({ categoriesEnabled: { ...projectSettings.notifications.categoriesEnabled, [category]: checked } })}
                label={category.charAt(0).toUpperCase() + category.slice(1)}
              />
            ))}
          </div>
        </div>
        <Switch
          checked={appSettings.notificationSystemSettings.soundsEnabled}
          onCheckedChange={(checked) => setNotificationSystemSettings({ ...appSettings.notificationSystemSettings, soundsEnabled: checked })}
          label="Enable Notification Sounds"
        />
        <div>
          <label className="block text-sm font-medium mb-1">Notification Display Duration</label>
          <Select
            value={appSettings.notificationSystemSettings.displayDuration.toString()}
            onValueChange={(value) => setNotificationSystemSettings({ ...appSettings.notificationSystemSettings, displayDuration: parseInt(value) })}
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

  const renderAllAgentsSection = () => (
    <div className="max-w-6xl">
      <h2 className="text-xl font-semibold mb-3">All Agents</h2>
      <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">Summaries across all runs, costs, and model performance.</div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Runs</div>
          <div className="text-lg font-semibold">{agentsSummary.totalRuns}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Active Runs</div>
          <div className="text-lg font-semibold">{agentsSummary.active}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Cost</div>
          <div className="text-lg font-semibold">{formatUSD(agentsSummary.totals.cost)}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Avg Cost/Run</div>
          <div className="text-lg font-semibold">{formatUSD(agentsSummary.totalRuns ? agentsSummary.totals.cost / agentsSummary.totalRuns : 0)}</div>
        </div>
      </div>

      {/* Model leaderboard */}
      <div className="mb-6">
        <h3 className="text-base font-semibold mb-2">Model Performance</h3>
        {agentsSummary.modelRows.length === 0 ? (
          <div className="text-sm text-neutral-500">No runs yet.</div>
        ) : (
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Provider</th>
                  <th className="text-left px-3 py-2">Model</th>
                  <th className="text-right px-3 py-2">Runs</th>
                  <th className="text-right px-3 py-2">Total Cost</th>
                  <th className="text-right px-3 py-2">Avg Cost</th>
                  <th className="text-right px-3 py-2">Tokens (P/C)</th>
                  <th className="text-right px-3 py-2">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {agentsSummary.modelRows.map((m) => (
                  <tr key={`${m.provider}::${m.model}`} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2">{m.provider}</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.model}</td>
                    <td className="px-3 py-2 text-right">{m.count}</td>
                    <td className="px-3 py-2 text-right">{formatUSD(m.cost)}</td>
                    <td className="px-3 py-2 text-right">{formatUSD(m.avgCost)}</td>
                    <td className="px-3 py-2 text-right">{m.prompt} / {m.completion}</td>
                    <td className="px-3 py-2 text-right">{formatTs(m.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent runs */}
      <div>
        <h3 className="text-base font-semibold mb-2">Recent Runs</h3>
        {runs.length === 0 ? (
          <div className="text-sm text-neutral-500">No runs yet.</div>
        ) : (
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Run</th>
                  <th className="text-left px-3 py-2">Project</th>
                  <th className="text-left px-3 py-2">Task/Feature</th>
                  <th className="text-left px-3 py-2">Model</th>
                  <th className="text-left px-3 py-2">State</th>
                  <th className="text-left px-3 py-2">Message</th>
                  <th className="text-right px-3 py-2">Cost</th>
                  <th className="text-right px-3 py-2">Tokens</th>
                  <th className="text-right px-3 py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice().sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map((r) => (
                  <tr key={r.runId} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="px-3 py-2 font-mono text-xs">{r.runId.slice(0,8)}</td>
                    <td className="px-3 py-2">{r.projectId}</td>
                    <td className="px-3 py-2">{r.taskId ?? '—'}{r.featureId ? ` · ${r.featureId}` : ''}</td>
                    <td className="px-3 py-2">{r.provider ?? '—'}{r.model ? ` / ${r.model}` : ''}</td>
                    <td className="px-3 py-2">{r.state}</td>
                    <td className="px-3 py-2 truncate max-w-[320px]" title={r.message ?? ''}>{r.message ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{formatUSD(r.costUSD)}</td>
                    <td className="px-3 py-2 text-right">{(r.promptTokens ?? 0)} / {(r.completionTokens ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{formatTs(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
      {!isAppSettingsLoaded && <div className="empty" aria-live="polite">Loading your preferences…</div>}
      {isAppSettingsLoaded && activeCategory === 'visual' && renderVisualSection()}
      {isAppSettingsLoaded && activeCategory === 'llms' && renderLLMsSection()}
      {isAppSettingsLoaded && activeCategory === 'agents' && renderAllAgentsSection()}
      {isAppSettingsLoaded && activeCategory === 'notifications' && renderNotificationsSection()}
    </CollapsibleSidebar>
  );
}
