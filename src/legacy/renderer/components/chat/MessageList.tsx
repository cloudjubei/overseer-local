import React, { useCallback, useMemo } from 'react'
import type { CompletionMessage } from 'thefactory-tools'
import { MessageList as MessageListBase } from 'thefactory-ui/web'
import { useFiles } from '../../contexts/FilesContext'
import { useActiveProject } from '../../contexts/ProjectContext'
import { useChatUnread } from '@renderer/hooks/useChatUnread'
import { factoryToolsService } from '@renderer/services/factoryToolsService'
import { renderToolCallPreview, getToolHeaderPath } from './ToolCall/sharedRenderers'
import DependencyBullet from '@renderer/components/stories/DependencyBullet'

export default function MessageList({
  chatId,
  messages,
  isThinking,
  onResumeTools,
  numberMessagesToSend,
  onDeleteLastMessage,
  onAtBottomChange,
  onReadLatest,
  scrollToBottomSignal,
  onRetry,
}: {
  chatId?: string
  messages: CompletionMessage[]
  isThinking: boolean
  onResumeTools?: (toolIds: string[]) => void
  numberMessagesToSend?: number
  onDeleteLastMessage?: () => void
  onAtBottomChange?: (atBottom: boolean) => void
  onReadLatest?: (iso?: string) => void
  scrollToBottomSignal?: number
  onRetry?: () => void
}) {
  const { projectId } = useActiveProject()
  const { filesByPath } = useFiles()
  const { getLastReadForKey } = useChatUnread()

  // -- Inline @ file mentions
  const onResolveFile = useCallback(
    (token: string) => {
      const exact = filesByPath[token]
      if (exact) return exact
      const short = token.split('/').pop() || token
      return filesByPath[short] ?? null
    },
    [filesByPath],
  )

  // -- Inline #refs (story / feature dependency bullet)
  const renderDependency = useCallback(
    (dep: string) => <DependencyBullet dependency={dep.startsWith('#') ? dep.slice(1) : dep} />,
    [],
  )

  // -- Per-tool preview cache fetcher — defers to the backend's previewTool.
  const previewTool = useCallback(
    async (_toolCallId: string, toolName: string, args: unknown) => {
      if (!projectId) return undefined
      return factoryToolsService.previewTool(projectId, toolName, args)
    },
    [projectId],
  )

  // Tracks the last-read ISO so the shared list opens at the first unread.
  const lastReadIso = useMemo(
    () => (chatId ? getLastReadForKey(chatId) : undefined),
    [chatId, getLastReadForKey],
  )

  return (
    <MessageListBase
      chatId={chatId}
      messages={messages as never[]}
      isThinking={isThinking}
      onResumeTools={onResumeTools}
      numberMessagesToSend={numberMessagesToSend}
      onDeleteLastMessage={onDeleteLastMessage}
      onAtBottomChange={onAtBottomChange}
      onReadLatest={onReadLatest}
      scrollToBottomSignal={scrollToBottomSignal}
      onRetry={onRetry}
      previewTool={previewTool}
      lastReadIso={lastReadIso}
      onResolveFile={onResolveFile}
      renderDependency={renderDependency}
      renderToolResult={renderToolCallPreview}
      getToolHeaderPath={getToolHeaderPath}
    />
  )
}
