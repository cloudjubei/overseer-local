import { useEffect, useRef, useState } from 'react';
import { LLMConfigManager } from '../utils/LLMConfigManager';
import type { LLMConfig } from '../types';

export function useLLMConfig() {
  const managerRef = useRef<LLMConfigManager | null>(null);
  const [config, setConfig] = useState<LLMConfig>({ apiBaseUrl: '', apiKey: '', model: '' });
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    managerRef.current = new LLMConfigManager();
    const loaded = managerRef.current.getConfig();
    setConfig(loaded);
    setIsConfigured(managerRef.current.isConfigured());
  }, []);

  const save = (next: LLMConfig) => {
    managerRef.current?.save(next);
    setConfig(next);
    setIsConfigured(!!next.apiKey);
  };

  return { config, setConfig, isConfigured, save };
}
