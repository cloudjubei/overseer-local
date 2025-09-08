import React, { useEffect, useMemo, useState } from 'react';
import type { LiveDataProvider, LiveDataProviderStatus } from '../../live-data/liveDataTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import useLiveData from '../hooks/useLiveData';


function formatLastUpdated(ts: number | undefined | null) {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'never';
  }
}

export default function LiveDataView() {
  const { services, servicesById, triggerUpdate, updateConfig } = useLiveData()

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Live Data</h1>
      {services.length === 0 ? (
        <div className="mt-4 text-gray-700">No live data services are configured.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {services.map((s) => (
            <div key={s.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  {s.description && <div className="text-sm text-gray-600">{s.description}</div>}
                </div>
                <button
                  disabled={!!s.isUpdating}
                  onClick={() => triggerUpdate(s.id)}
                  className={`px-3 py-1 rounded text-white ${s.isUpdating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {s.isUpdating ? 'Updating…' : 'Update now'}
                </button>
              </div>

              {/* Status row */}
              <div className="mt-2 text-sm text-gray-700 flex flex-wrap gap-4">
                <span>
                  Status: <span className={s.isFresh ? 'text-green-600' : 'text-amber-700'}>{s.isFresh ? 'Up to date' : 'Stale'}</span>
                </span>
                <span>Last updated: {formatLastUpdated(s.lastUpdated)}</span>
              </div>

              {/* Configuration controls */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Freshness policy */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-[var(--text-primary)]">Freshness policy</label>
                  <Select
                    value={s.freshnessPolicy}
                    onValueChange={(val: LiveDataProvider['freshnessPolicy']) =>
                      updateConfig(s.id, { freshnessPolicy: val })
                    }
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Select policy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-update toggle and trigger */}
                <div className="flex flex-col gap-2">
                  <Switch
                    checked={!!s.autoUpdate?.enabled}
                    onCheckedChange={(checked) =>
                      updateConfig(s.id, { autoUpdate: { ...(s.autoUpdate || { trigger: 'onAppLaunch' }), enabled: checked } })
                    }
                    label="Automated checks"
                  />
                  {s.autoUpdate?.enabled && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-secondary)]">When:</span>
                      <Select
                        value={s.autoUpdate?.trigger || 'onAppLaunch'}
                        onValueChange={(val: 'onAppLaunch' | 'scheduled') =>
                          updateConfig(s.id, { autoUpdate: { ...(s.autoUpdate || { enabled: true }), trigger: val } })
                        }
                      >
                        <SelectTrigger size="sm" className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onAppLaunch">On app launch</SelectItem>
                          <SelectItem value="scheduled">On schedule</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
