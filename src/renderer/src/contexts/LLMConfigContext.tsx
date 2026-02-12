import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { LLMConfig } from 'thefactory-tools'
import { llmConfigsService } from '../services/llmConfigsService'

export type LLMConfigContextValue = {
  configs: LLMConfig[]

  activeAgentRunConfigId?: string
  activeAgentRunConfig?: LLMConfig
  isAgentRunConfigured: boolean
  setActiveAgentRun: (id: string) => void
  recentAgentRunConfigs: LLMConfig[]

  activeChatConfigId?: string
  activeChatConfig?: LLMConfig
  isChatConfigured: boolean
  setActiveChat: (id: string) => void
  recentChatConfigs: LLMConfig[]

  addConfig: (config: Omit<LLMConfig, 'id'>) => void
  updateConfig: (id: string, updates: Partial<LLMConfig>) => void
  removeConfig: (id: string) => void
}

const LLMConfigContext = createContext<LLMConfigContextValue | null>(null)

export function LLMConfigProvider({ children }: { children: React.ReactNode }) {
  const managerRef = useRef<LLMConfigManager>(new LLMConfigManager())
  const [configs, setConfigs] = useState<LLMConfig[]>([])

  const [activeAgentRunConfigId, setActiveAgentRunConfigId] = useState<string>('')
  const [recentAgentRunIds, setRecentAgentRunIds] = useState<string[]>([])

  const [activeChatConfigId, setActiveChatConfigId] = useState<string>('')
  const [recentChatIds, setRecentChatIds] = useState<string[]>([])

  const refresh = useCallback(() => {
    setConfigs(managerRef.current.getConfigs())
    setActiveAgentRunConfigId(managerRef.current.getAgentRunActiveId())
    setRecentAgentRunIds(managerRef.current.getAgentRunRecentIds())
    setActiveChatConfigId(managerRef.current.getChatActiveId())
    setRecentChatIds(managerRef.current.getChatRecentIds())
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener)
    return () => window.removeEventListener(LLM_CONFIGS_CHANGED_EVENT, handler as EventListener)
  }, [refresh])

  const activeAgentRunConfig: LLMConfig | undefined = useMemo(() => {
    if (activeAgentRunConfigId) {
      return configs.find((c) => c.id === activeAgentRunConfigId)
    }
    return
  }, [configs, activeAgentRunConfigId])

  const isAgentRunConfigured = useMemo(() => !!activeAgentRunConfig?.apiKey, [activeAgentRunConfig])

  const recentAgentRunConfigs: LLMConfig[] = useMemo(() => {
    const map = new Map(configs.map((c) => [c.id, c] as const))
    const items = recentAgentRunIds.map((id) => map.get(id)).filter(Boolean) as LLMConfig[]
    const base = items.length > 0 ? items : configs
    return base.slice(0, 5)
  }, [configs, recentAgentRunIds])

  const setActiveAgentRun = useCallback(
    (id: string) => {
      managerRef.current.setAgentRunActiveId(id)
      refresh()
    },
    [refresh],
  )

  const activeChatConfig: LLMConfig | undefined = useMemo(() => {
    if (activeChatConfigId) {
      return configs.find((c) => c.id === activeChatConfigId)
    }
    return
  }, [configs, activeChatConfigId])

  const isChatConfigured = useMemo(() => !!activeChatConfig?.apiKey, [activeChatConfig])

  const recentChatConfigs: LLMConfig[] = useMemo(() => {
    const map = new Map(configs.map((c) => [c.id, c] as const))
    const items = recentChatIds.map((id) => map.get(id)).filter(Boolean) as LLMConfig[]
    const base = items.length > 0 ? items : configs
    return base.slice(0, 5)
  }, [configs, recentChatIds])

  const setActiveChat = useCallback(
    (id: string) => {
      managerRef.current.setChatActiveId(id)
      refresh()
    },
    [refresh],
  )

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

  const value = useMemo<LLMConfigContextValue>(
    () => ({
      activeAgentRunConfigId,
      activeAgentRunConfig,
      isAgentRunConfigured,
      setActiveAgentRun,
      recentAgentRunConfigs,

      activeChatConfigId,
      activeChatConfig,
      isChatConfigured,
      setActiveChat,
      recentChatConfigs,

      configs,
      addConfig,
      updateConfig,
      removeConfig,
    }),
    [
      activeAgentRunConfigId,
      activeAgentRunConfig,
      isAgentRunConfigured,
      setActiveAgentRun,
      recentAgentRunConfigs,

      activeChatConfigId,
      activeChatConfig,
      isChatConfigured,
      setActiveChat,
      recentChatConfigs,

      configs,
      addConfig,
      updateConfig,
      removeConfig,
    ],
  )

  return <LLMConfigContext.Provider value={value}>{children}</LLMConfigContext.Provider>
}

export function useLLMConfig(): LLMConfigContextValue {
  const ctx = useContext(LLMConfigContext)
  if (!ctx) throw new Error('useLLMConfig must be used within LLMConfigProvider')
  return ctx
}
