import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LLMConfigManager, LLM_CONFIGS_CHANGED_EVENT } from '../utils/LLMConfigManager';
import type { LLMConfig } from 'thefactory-tools';

export function useLLMConfig() { //TODO; transform into Context like AppSettings (after them)
  const managerRef = useRef<LLMConfigManager>(new LLMConfigManager());
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const refresh = useCallback(() => {
    setConfigs(managerRef.current.getConfigs());
    setActiveConfigId(managerRef.current.getActiveId());
    try { setRecentIds(managerRef.current.getRecentIds()); } catch { setRecentIds([]); }
  }, []);

  useEffect(() => {
    // initial load
    refresh();
    // subscribe to cross-instance changes
    const handler = () => refresh();
    window.addEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener);
  }, [refresh]);

  const activeConfig : LLMConfig | undefined = useMemo(() => {
    if (activeConfigId){
      return configs.find(c => c.id === activeConfigId)
    }
  }, [configs, activeConfigId]);

  const isConfigured = useMemo(() => !!activeConfig?.apiKey, [activeConfig]);

  const addConfig = useCallback((config: Omit<LLMConfig, 'id'>) => {
    managerRef.current.addConfig(config);
    refresh();
  }, [refresh]);

  const updateConfig = useCallback((id: string, updates: Partial<LLMConfig>) => {
    managerRef.current.updateConfig(id, updates);
    refresh();
  }, [refresh]);

  const removeConfig = useCallback((id: string) => {
    managerRef.current.removeConfig(id);
    refresh();
  }, [refresh]);

  const setActive = useCallback((id: string) => {
    managerRef.current.setActiveId(id);
    refresh();
  }, [refresh]);

  const recentConfigs: LLMConfig[] = useMemo(() => {
    const map = new Map(configs.map(c => [c.id, c] as const));
    const items = recentIds.map(id => map.get(id)).filter(Boolean) as LLMConfig[];
    // fallback: if no explicit recent history, use current list order
    const base = items.length > 0 ? items : configs;
    return base.slice(0, 5);
  }, [configs, recentIds]);

  return { configs, activeConfigId, activeConfig, isConfigured, addConfig, updateConfig, removeConfig, setActive, recentConfigs, recentIds };
}
