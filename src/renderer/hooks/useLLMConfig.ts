import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LLMConfigManager, LLM_CONFIGS_CHANGED_EVENT } from '../utils/LLMConfigManager';
import { LLMConfig } from '../services/chatsService';

export function useLLMConfig() {
  const managerRef = useRef<LLMConfigManager>(new LLMConfigManager());
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setConfigs(managerRef.current.getConfigs());
    setActiveConfigId(managerRef.current.getActiveId());
  }, []);

  useEffect(() => {
    // initial load
    refresh();
    // subscribe to cross-instance changes
    const handler = () => refresh();
    window.addEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener);
    return () => window.removeEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener);
  }, [refresh]);

  const activeConfig = useMemo(() => 
    configs.find(c => c.id === activeConfigId) || null,
  [configs, activeConfigId]);

  const isConfigured = useMemo(() => !!activeConfig?.apiKey, [activeConfig]);

  const addConfig = useCallback((config: Omit<LLMConfig, 'id'>) => {
    managerRef.current.addConfig(config);
    // local optimistic refresh (global event also fires)
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

  return { configs, activeConfigId, activeConfig, isConfigured, addConfig, updateConfig, removeConfig, setActive };
}
