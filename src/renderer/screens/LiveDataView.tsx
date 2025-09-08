import React, { useEffect, useMemo, useState } from 'react';
import type { LiveDataService } from '../../live-data/types';

// Renderer-side status extends base type with runtime flags from main
export type LiveDataServiceStatus = LiveDataService & {
  isUpdating?: boolean;
  isFresh?: boolean;
};

function formatLastUpdated(ts: number | undefined | null) {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'never';
  }
}

export default function LiveDataView() {
  const [services, setServices] = useState<LiveDataServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    async function init() {
      try {
        const status: LiveDataServiceStatus[] = await (window as any).liveData.getStatus();
        if (!mounted) return;
        setServices(status);
      } finally {
        if (mounted) setLoading(false);
      }
      unsubscribe = (window as any).liveData.onStatusUpdated((payload: LiveDataServiceStatus[]) => {
        setServices(payload);
      });
    }
    init();
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const trigger = (id: string) => (window as any).liveData.triggerUpdate(id);

  const items = useMemo(() => services, [services]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Live Data</h1>
      {loading ? (
        <p className="mt-2 text-gray-600">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-4 text-gray-700">No live data services are configured.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((s) => (
            <div key={s.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  {s.description && <div className="text-sm text-gray-600">{s.description}</div>}
                </div>
                <button
                  disabled={!!s.isUpdating}
                  onClick={() => trigger(s.id)}
                  className={`px-3 py-1 rounded text-white ${s.isUpdating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {s.isUpdating ? 'Updating…' : 'Update now'}
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-700 flex flex-wrap gap-4">
                <span>
                  Status: <span className={s.isFresh ? 'text-green-600' : 'text-amber-700'}>{s.isFresh ? 'Up to date' : 'Stale'}</span>
                </span>
                <span>Last updated: {formatLastUpdated(s.lastUpdated)}</span>
                <span>Freshness policy: {s.freshnessPolicy}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
