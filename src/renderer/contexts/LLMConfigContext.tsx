import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { LLMConfigManager, LLM_CONFIGS_CHANGED_EVENT } from '../utils/LLMConfigManager'
import type { LLMConfig } from 'thefactory-tools'

export type LLMConfigContextValue = {
  configs: LLMConfig[]
  activeConfigId: string | null
  activeConfig?: LLMConfig
  isConfigured: boolean
  recentConfigs: LLMConfig[]
  recentIds: string[]

  addConfig: (config: Omit<LLMConfig, 'id'>) => void
  updateConfig: (id: string, updates: Partial<LLMConfig>) => void
  removeConfig: (id: string) => void
  setActive: (id: string) => void
}

const LLMConfigContext = createContext<LLMConfigContextValue | null>(null)

export function LLMConfigProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<LLMConfigManager>(new LLMConfigManager())
  const [configs, setConfigs] = useState<LLMConfig[]>([])
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])

  const refresh = useCallback(() => {
    setConfigs(managerRef.current.getConfigs())
    setActiveConfigId(managerRef.current.getActiveId())
    try {
      setRecentIds(managerRef.current.getRecentIds())
    } catch {
      setRecentIds([])
    }
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener)
  }, [refresh])

  const activeConfig: LLMConfig | undefined = useMemo(() => {
    if (activeConfigId) {
      return configs.find((c) => c.id === activeConfigId)
    }
  }, [configs, activeConfigId])

  const isConfigured = useMemo(() => !!activeConfig?.apiKey, [activeConfig])

  const addConfig = useCallback(
    (config: Omit<LLMConfig, 'id'>) => {
      managerRef.current.addConfig(config)
      refresh()
    },
    [refresh],
  )

  const updateConfig = useCallback(
    (id: string, updates: Partial<LLMConfig>) => {
      managerRef.current.updateConfig(id, updates)
      refresh()
    },
    [refresh],
  )

  const removeConfig = useCallback(
    (id: string) => {
      managerRef.current.removeConfig(id)
      refresh()
    },
    [refresh],
  )

  const setActive = useCallback(
    (id: string) => {
      managerRef.current.setActiveId(id)
      refresh()
    },
    [refresh],
  )

  const recentConfigs: LLMConfig[] = useMemo(() => {
    const map = new Map(configs.map((c) => [c.id, c] as const))
    const items = recentIds.map((id) => map.get(id)).filter(Boolean) as LLMConfig[]
    const base = items.length > 0 ? items : configs
    return base.slice(0, 5)
  }, [configs, recentIds])

  const value = useMemo<LLMConfigContextValue>(
    () => ({
      configs,
      activeConfigId,
      activeConfig,
      isConfigured,
      addConfig,
      updateConfig,
      removeConfig,
      setActive,
      recentConfigs,
      recentIds,
    }),
    [
      configs,
      activeConfigId,
      activeConfig,
      isConfigured,
      addConfig,
      updateConfig,
      removeConfig,
      setActive,
      recentConfigs,
      recentIds,
    ],
  )

  return <LLMConfigContext.Provider value={value}>{children}</LLMConfigContext.Provider>
}

export function useLLMConfig(): LLMConfigContextValue {
  const ctx = useContext(LLMConfigContext)
  if (!ctx) throw new Error('useLLMConfig must be used within LLMConfigProvider')
  return ctx
}
