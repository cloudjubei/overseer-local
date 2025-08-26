import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import type { LLMConfig } from '../types';

export function useLLMConfig() {
  const managerRef = useRef<LLMConfigManager>(new LLMConfigManager());
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  useEffect(() => {
    setConfigs(managerRef.current.getConfigs());
    setActiveConfigId(managerRef.current.getActiveId());
  }, []);

  const activeConfig = useMemo(() => 
    configs.find(c => c.id === activeConfigId) || null,
  [configs, activeConfigId]);

  const isConfigured = useMemo(() => !!activeConfig?.apiKey, [activeConfig]);

  const addConfig = useCallback((config: Omit<LLMConfig, 'id'>) => {
    managerRef.current.addConfig(config);
    setConfigs(managerRef.current.getConfigs());
    setActiveConfigId(managerRef.current.getActiveId());
  }, []);

  const updateConfig = useCallback((id: string, updates: Partial<LLMConfig>) => {
    managerRef.current.updateConfig(id, updates);
    setConfigs(managerRef.current.getConfigs());
  }, []);

  const removeConfig = useCallback((id: string) => {
    managerRef.current.removeConfig(id);
    setConfigs(managerRef.current.getConfigs());
    setActiveConfigId(managerRef.current.getActiveId());
  }, []);

  const setActive = useCallback((id: string) => {
    managerRef.current.setActiveId(id);
    setActiveConfigId(id);
  }, []);

  return { configs, activeConfigId, activeConfig, isConfigured, addConfig, updateConfig, removeConfig, setActive };
}
