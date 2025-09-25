import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLLMConfig } from '../../contexts/LLMConfigContext'
import { useNavigator } from '../../navigation/Navigator'
import ChatSidebar from './ChatSidebar'
import { factoryToolsService } from '../../services/factoryToolsService'
import { ChatsProvider, useChatsContext } from '../../contexts/ContextualChatsContext'
import { useProjectSettings } from '../../hooks/useProjectSettings'

interface ContextualChatSidebarProps {
  contextId: string
  chatContextTitle: string
}

type ToolToggle = { id: string; name: string; enabled: boolean }

function parseProjectIdFromContextId(contextId: string): string | undefined {
  if (!contextId) return undefined
  const atIdx = contextId.indexOf('@')
  if (atIdx > 0) return contextId.slice(0, atIdx)
  const parts = contextId.split('/').filter(Boolean)
  return parts[0]
}

const ChatView: React.FC<{ chatContextTitle: string; contextId: string }> = ({
  chatContextTitle,
  contextId,
}) => {
  const { chat, sendMessage, isThinking } = useChatsContext()
  const { configs, activeConfigId, activeConfig, isConfigured, setActive } = useLLMConfig()
  const { navigateView } = useNavigator()

  const projectId = useMemo(() => parseProjectIdFromContextId(contextId), [contextId])
  const { projectSettings, updateProjectSettings, setNotificationProjectSettings } =
    useProjectSettings()

  const settings = projectSettings?.chatSettings
  const setSettings = useCallback(
    async (patch: any) => {
      await updateProjectSettings({ chatSettings: { ...(settings || {}), ...(patch || {}) } })
      setNotificationProjectSettings({ chatSettings: { ...(settings || {}), ...(patch || {}) } })
    },
    [settings, updateProjectSettings, setNotificationProjectSettings],
  )

  const [tools, setTools] = useState<ToolToggle[] | undefined>(undefined)

  useEffect(() => {
    let isMounted = true
    async function load() {
      if (!projectId) return
      try {
        const list = await factoryToolsService.listTools(projectId)
        const toggles = settings?.toolToggles || {}
        const mapped: ToolToggle[] = list.map((t) => ({
          id: t.name,
          name: t.name,
          enabled: toggles[t.name] != null ? !!toggles[t.name] : true,
        }))
        if (isMounted) setTools(mapped)
      } catch (e) {
        if (isMounted) setTools([])
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [projectId, settings?.toolToggles])

  const selectedConfigId = settings?.modelConfigId ?? activeConfigId ?? undefined
  const effectiveConfig = useMemo(
    () =>
      (selectedConfigId ? configs.find((c) => c.id === selectedConfigId) : activeConfig) || null,
    [configs, selectedConfigId, activeConfig],
  )

  const effectiveIsConfigured = !!effectiveConfig?.apiKey

  const handleSendMessage = async (message: string, attachments: string[]) => {
    if (!effectiveConfig) return
    await sendMessage(message, effectiveConfig, attachments)
  }

  const handleConfigChange = useCallback(
    async (configId: string) => {
      await setSettings({ modelConfigId: configId })
      setActive(configId)
    },
    [setSettings, setActive],
  )

  const handleToolToggle = useCallback(
    async (toolId: string) => {
      const current = settings?.toolToggles || {}
      const next = { ...current, [toolId]: !(current[toolId] != null ? current[toolId] : true) }
      await setSettings({ toolToggles: next })
    },
    [settings?.toolToggles, setSettings],
  )

  const handleAutoApproveChange = useCallback(
    async (checked: boolean) => {
      await setSettings({ autoApprove: checked })
    },
    [setSettings],
  )

  return (
    <ChatSidebar
      chatContextTitle={chatContextTitle}
      currentChat={chat}
      isThinking={isThinking}
      isConfigured={effectiveIsConfigured}
      onSend={handleSendMessage}
      configs={configs}
      activeConfigId={selectedConfigId || undefined}
      onConfigChange={handleConfigChange}
      onConfigure={() => navigateView('Settings')}
      activeConfig={effectiveConfig}
      tools={tools}
      onToolToggle={tools ? handleToolToggle : undefined}
      autoApprove={settings?.autoApprove}
      onAutoApproveChange={handleAutoApproveChange}
    />
  )
}

export default function ContextualChatSidebar({
  contextId,
  chatContextTitle,
}: ContextualChatSidebarProps) {
  return (
    <ChatsProvider contextId={contextId}>
      <ChatView contextId={contextId} chatContextTitle={chatContextTitle} />
    </ChatsProvider>
  )
}
