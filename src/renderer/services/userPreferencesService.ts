import type { UserPreferences } from '../../types/userPreferences';

// Default preferences mirror main process defaults
const DEFAULT_PREFERENCES: Required<UserPreferences> = {
  lastActiveProjectId: null as unknown as string | undefined,
  tasksViewMode: 'list',
  tasksListView: {
    sortBy: 'order',
    sortDirection: 'asc',
  },
  notifications: {
    osNotificationsEnabled: true,
    soundsEnabled: true,
    displayDuration: 5,
  },
} as any;

// Fallback localStorage key
const LS_KEY = 'user-preferences';

type PreferencesUpdates = Partial<UserPreferences>;

function getBridge() {
  // Attempt preload-exposed API first
  return (window as any).preferencesService as
    | { get: () => Promise<UserPreferences>; update: (updates: PreferencesUpdates) => Promise<UserPreferences> }
    | undefined;
}

async function getViaBridge(): Promise<UserPreferences | null> {
  try {
    const bridge = getBridge();
    if (!bridge) return null;
    const prefs = await bridge.get();
    return prefs || {};
  } catch {
    return null;
  }
}

async function updateViaBridge(updates: PreferencesUpdates): Promise<UserPreferences | null> {
  try {
    const bridge = getBridge();
    if (!bridge) return null;
    const prefs = await bridge.update(updates);
    return prefs || {};
  } catch {
    return null;
  }
}

function getViaLocal(): UserPreferences {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function updateViaLocal(updates: PreferencesUpdates): UserPreferences {
  const current = getViaLocal();
  const merged: UserPreferences = {
    ...current,
    ...updates,
    // deep-merge known nested shapes to avoid clobbering
    tasksListView: { ...current.tasksListView, ...(updates.tasksListView || {}) },
    notifications: { ...current.notifications, ...(updates.notifications || {}) },
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

export const userPreferencesService = {
  async getPreferences(): Promise<UserPreferences> {
    const viaBridge = await getViaBridge();
    if (viaBridge) return { ...DEFAULT_PREFERENCES, ...viaBridge };
    return getViaLocal();
  },

  async updatePreferences(updates: PreferencesUpdates): Promise<UserPreferences> {
    const viaBridge = await updateViaBridge(updates);
    if (viaBridge) return { ...DEFAULT_PREFERENCES, ...viaBridge };
    return updateViaLocal(updates);
  },

  async getLastActiveProjectId(): Promise<string | null> {
    const prefs = await this.getPreferences();
    const id = prefs.lastActiveProjectId ?? null;
    return id as string | null;
  },

  async setLastActiveProjectId(projectId: string | null): Promise<void> {
    await this.updatePreferences({ lastActiveProjectId: projectId ?? undefined });
  },
};

export default userPreferencesService;
