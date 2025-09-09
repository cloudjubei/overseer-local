import { useState } from 'react';
import type { LiveDataProvider, LiveDataProviderScope, LiveDataProviderStatus } from '../../live-data/LiveDataTypes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { Switch } from '../components/ui/Switch';
import useLiveData from '../hooks/useLiveData';
import { useActiveProject } from '../projects/ProjectContext';

function formatLastUpdated(ts: number | undefined | null) {
  if (!ts) return 'never';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return 'never';
  }
}

function JsonBlock({ data }: { data: any }) {
  return (
    <pre className="mt-2 max-h-80 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-800 border">
      {data == null ? 'No data available.' : JSON.stringify(data, null, 2)}
    </pre>
  );
}

type NewServiceForm = {
  id: string;
  name: string;
  description: string;
  url: string;
  freshnessPolicy: LiveDataProvider['freshnessPolicy'];
  autoEnabled: boolean;
  autoTrigger: 'onAppLaunch' | 'scheduled';
  scope: 'global' | 'project';
};

export default function LiveDataView() {
  const { projectId, project } = useActiveProject();
  const { services, triggerUpdate, updateConfig, addService } = useLiveData()
  const [openViewer, setOpenViewer] = useState<Record<string, boolean>>({});
  const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});
  const [serviceData, setServiceData] = useState<Record<string, any>>({});
  const [errorByService, setErrorByService] = useState<Record<string, string | undefined>>({});

  const [showAddForm, setShowAddForm] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState<string | undefined>(undefined);
  const [newSvc, setNewSvc] = useState<NewServiceForm>({
    id: '',
    name: '',
    description: '',
    url: '',
    freshnessPolicy: 'daily',
    autoEnabled: true,
    autoTrigger: 'onAppLaunch',
    scope: 'project',
  });

  const toggleViewer = async (s: LiveDataProviderStatus) => {
    const isOpen = !!openViewer[s.id];
    const next = { ...openViewer, [s.id]: !isOpen };
    setOpenViewer(next);

    // If opening and no data loaded yet, try to fetch it now.
    if (!isOpen && serviceData[s.id] === undefined) {
      await fetchLatestForService(s);
    }
  };

  const fetchLatestForService = async (s: LiveDataProviderStatus) => {
    setLoadingData(prev => ({ ...prev, [s.id]: true }));
    setErrorByService(prev => ({ ...prev, [s.id]: undefined }));

    try {
      let data: any = null;
      if ((window as any).liveDataService?.getData) {
        data = await (window as any).liveDataService.getData(s.id);
      }
      setServiceData(prev => ({ ...prev, [s.id]: data }));
    } catch (e: any) {
      setErrorByService(prev => ({ ...prev, [s.id]: e?.message || 'Failed to load latest data' }));
    } finally {
      setLoadingData(prev => ({ ...prev, [s.id]: false }));
    }
  };

  const handleUpdateNow = async (s: LiveDataProviderStatus) => {
    try {
      await triggerUpdate(s.id);
    } finally {
      // If the JSON viewer is open for this service, refresh its data preview to reflect latest updates
      if (openViewer[s.id]) {
        await fetchLatestForService(s);
      }
    }
  };

  const resetAddForm = () => {
    setNewSvc({ id: '', name: '', description: '', url: '', freshnessPolicy: 'daily', autoEnabled: true, autoTrigger: 'onAppLaunch', scope: 'project' });
    setAddError(undefined);
  };

  const handleSaveNewService = async () => {
    setAddError(undefined);
    if (!newSvc.id || !newSvc.name) {
      setAddError('Please provide both an ID and a Name.');
      return;
    }
    // Basic URL check if provided
    if (newSvc.url && !/^https?:\/\//i.test(newSvc.url)) {
      setAddError('URL must start with http:// or https://');
      return;
    }

    setSavingNew(true);
    try {
      const payload: LiveDataProvider = {
        id: newSvc.id.trim(),
        name: newSvc.name.trim(),
        description: newSvc.description?.trim() || '',
        lastUpdated: 0,
        freshnessPolicy: newSvc.freshnessPolicy,
        autoUpdate: { enabled: !!newSvc.autoEnabled, trigger: newSvc.autoTrigger },
        config: newSvc.url ? { url: newSvc.url.trim() } : {},
        scope: newSvc.scope,
        projectId: newSvc.scope === 'project' ? projectId : null,
      };
      await addService(payload);
      setShowAddForm(false);
      resetAddForm();
    } catch (e: any) {
      setAddError(e?.message || 'Failed to add service');
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Live Data</h1>
        <button
          className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setShowAddForm(v => !v)}
        >
          {showAddForm ? 'Cancel' : '+ Add provider'}
        </button>
      </div>

      {showAddForm && (
        <div className="mt-4 border rounded p-3 bg-white">
          <div className="font-semibold mb-2">Add live data provider</div>

          {addError && <div className="text-sm text-red-700 mb-2">{addError}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">ID</label>
              <input
                className="border rounded px-2 py-1 text-sm"
                value={newSvc.id}
                onChange={e => setNewSvc({ ...newSvc, id: e.target.value })}
                placeholder="unique-id"
              />
              <span className="text-xs text-gray-500">Must be unique. For custom JSON providers, choose any id.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Name</label>
              <input
                className="border rounded px-2 py-1 text-sm"
                value={newSvc.name}
                onChange={e => setNewSvc({ ...newSvc, name: e.target.value })}
                placeholder="Display name"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="border rounded px-2 py-1 text-sm"
                value={newSvc.description}
                onChange={e => setNewSvc({ ...newSvc, description: e.target.value })}
                placeholder="What does this provider fetch?"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium">Fetch URL (for JSON provider)</label>
              <input
                className="border rounded px-2 py-1 text-sm"
                value={newSvc.url}
                onChange={e => setNewSvc({ ...newSvc, url: e.target.value })}
                placeholder="https://example.com/data.json"
              />
              <span className="text-xs text-gray-500">If provided, this provider will fetch JSON from the URL using the generic fetcher.</span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Freshness policy</label>
              <Select
                value={newSvc.freshnessPolicy}
                onValueChange={(val: LiveDataProvider['freshnessPolicy']) =>
                  setNewSvc({ ...newSvc, freshnessPolicy: val })
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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Visibility</label>
              <Select
                value={newSvc.scope}
                onValueChange={(val: LiveDataProviderScope) => setNewSvc({ ...newSvc, scope: val })}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">This project only</SelectItem>
                  <SelectItem value="global">All projects (global)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-500">
                {newSvc.scope === 'project' ? `Will be attached to project: ${project!.title}` : 'Visible from every project.'}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Switch
                checked={!!newSvc.autoEnabled}
                onCheckedChange={(checked) => setNewSvc({ ...newSvc, autoEnabled: checked })}
                label="Automated checks"
              />
              {newSvc.autoEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--text-secondary)]">When:</span>
                  <Select
                    value={newSvc.autoTrigger}
                    onValueChange={(val: 'onAppLaunch' | 'scheduled') => setNewSvc({ ...newSvc, autoTrigger: val })}
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

          <div className="mt-3 flex gap-2">
            <button
              disabled={savingNew}
              onClick={handleSaveNewService}
              className={`px-3 py-1 rounded text-white ${savingNew ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {savingNew ? 'Adding…' : 'Add provider'}
            </button>
            <button
              disabled={savingNew}
              onClick={() => { setShowAddForm(false); resetAddForm(); }}
              className="px-3 py-1 rounded border text-gray-800 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {services.length === 0 ? (
        <div className="mt-4 text-gray-700">No live data services are configured for this project.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {services.map((s) => (
            <div key={s.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <span>{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${s.scope === 'project' ? 'text-purple-700 border-purple-300 bg-purple-50' : 'text-gray-700 border-gray-300 bg-gray-50'}`}>
                      {s.scope === 'project' ? 'Project' : 'Global'}
                    </span>
                  </div>
                  {s.description && <div className="text-sm text-gray-600">{s.description}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleViewer(s)}
                    className="px-3 py-1 rounded border text-gray-800 hover:bg-gray-50"
                  >
                    {openViewer[s.id] ? 'Hide data' : 'Show data'}
                  </button>
                  <button
                    disabled={!!s.isUpdating}
                    onClick={() => handleUpdateNow(s)}
                    className={`px-3 py-1 rounded text-white ${s.isUpdating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                  >
                    {s.isUpdating ? 'Updating…' : 'Update now'}
                  </button>
                </div>
              </div>

              {/* Status row */}
              <div className="mt-2 text-sm text-gray-700 flex flex-wrap gap-4">
                <span>
                  Status: <span className={s.isFresh ? 'text-green-600' : 'text-amber-700'}>{s.isFresh ? 'Up to date' : 'Stale'}</span>
                </span>
                <span>Last updated: {formatLastUpdated(s.lastUpdated)}</span>
              </div>

              {/* JSON viewer */}
              {openViewer[s.id] && (
                <div className="mt-3">
                  {loadingData[s.id] ? (
                    <div className="text-sm text-gray-600">Loading latest data…</div>
                  ) : errorByService[s.id] ? (
                    <div className="text-sm text-red-600">{errorByService[s.id]}</div>
                  ) : (
                    <JsonBlock data={serviceData[s.id]} />
                  )}
                  <div className="mt-2">
                    <button
                      onClick={() => fetchLatestForService(s)}
                      className="text-xs text-blue-700 underline"
                    >
                      Refresh data preview
                    </button>
                  </div>
                </div>
              )}

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
