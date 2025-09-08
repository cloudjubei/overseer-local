import React, { useEffect, useState } from 'react';

type Service = {
  id: string;
  name: string;
  description: string;
  lastUpdated: number;
  freshnessPolicy: 'daily' | 'weekly' | 'monthly';
  autoUpdate: { enabled: boolean; trigger: 'onAppLaunch' | 'scheduled' };
  config: any;
  isUpdating: boolean;
  isFresh?: boolean;
};

export default function LiveDataView() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const status = await (window as any).liveData.getStatus();
        setServices(status);
      } finally {
        setLoading(false);
      }
      unsubscribe = (window as any).liveData.onStatusUpdated((payload: Service[]) => {
        setServices(payload);
      });
    }
    init();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const trigger = (id: string) => (window as any).liveData.triggerUpdate(id);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Live Data</h1>
      {loading ? (
        <p className="mt-2 text-gray-600">Loading…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {services.map((s) => (
            <div key={s.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-gray-600">{s.description}</div>
                </div>
                <button
                  disabled={s.isUpdating}
                  onClick={() => trigger(s.id)}
                  className={`px-3 py-1 rounded text-white ${s.isUpdating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {s.isUpdating ? 'Updating…' : 'Update now'}
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-700 flex gap-4">
                <span>Freshness: {s.freshnessPolicy}</span>
                <span>Auto-update: {s.autoUpdate?.enabled ? s.autoUpdate.trigger : 'disabled'}</span>
                <span>Fresh: {s.isFresh ? 'yes' : 'no'}</span>
                <span>Last updated: {s.lastUpdated ? new Date(s.lastUpdated).toLocaleString() : 'never'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
