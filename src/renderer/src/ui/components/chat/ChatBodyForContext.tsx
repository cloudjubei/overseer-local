import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'
import {
  ChatBody,
  CliRunArtifactPanel,
  FeatureRequestIntroPanel,
  interpolatePrompt,
  type ChatBodyProps,
  type PromptVariables,
} from 'thefactory-ui/web'
import type { ChatContext } from 'thefactory-ui/headless/api'
import { useAgents } from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { useCrossProjectRequests } from 'thefactory-ui/headless'
import { useFiles } from 'thefactory-ui/headless'
import { useTools } from 'thefactory-ui/headless'
import { useStories } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { getChatContextKey } from '@core/chats/chatKey'
import { useBadgeCounts } from '@core/notifications/useBadgeCounts'
import { useChatContextLastRead as useChatLastRead } from 'thefactory-ui/web'
import { Button } from 'thefactory-ui/web'
import { getToolHeaderPath, renderToolCall } from './ToolCall/renderers'

export type ChatBodyForContextProps = {
  context: ChatContext
  /** Caller-rendered header slot. */
  header?: ReactNode
  /** Pass-through for placeholder + autoFocus. */
  inputProps?: Pick<NonNullable<ChatBodyProps['inputProps']>, 'autoFocus' | 'placeholder'>
}

/**
 * Web-side wrapper around the shared `ChatBody`. Pulls live state from
 * `ChatsContext`, wires the tool-call renderer registry, drives the
 * interpolated effective-system-prompt used by `MessageList` to render the
 * system bubble + "Start chatting" empty state, plumbs the draft /
 * attachment state, # references (stories + features), file attach, and
 * `chatLastRead`-based scroll positioning.
 */
export default function ChatBodyForContext({
  context,
  header,
  inputProps,
}: ChatBodyForContextProps) {
  const {
    activeLLMConfig,
    getChat,
    getChatLiveState,
    getDraft,
    setDraft,
    clearDraft,
    sendMessage,
    confirmTools,
    cancelToolConfirmation,
    abortChat,
    deleteLastMessage,
    getEffectiveChatSettings,
  } = useChats()
  const { cancelRun } = useAgents()
  const { paths, files, uploadFile } = useFiles()
  const { previewTool } = useTools()
  const { project } = useActiveProject()
  const { stories, getStory, getFeature, storyDisplayIndex, featureDisplayIndex } = useStories()
  const { markChatSeen } = useBadgeCounts()
  const { lastReadIso, markReadByContext } = useChatLastRead(context)

  const chat = getChat(context)
  const liveState = getChatLiveState(context)
  const contextKey = getChatContextKey(context)

  // ---- Effective system prompt (interpolated) -----------------------------
  const effectiveSettings = useMemo(
    () => getEffectiveChatSettings(context),
    [context, getEffectiveChatSettings],
  )
  const template = effectiveSettings.systemPrompt ?? ''
  const completionSettings = effectiveSettings.completionSettings
  const promptVariables = useMemo<PromptVariables>(() => {
    const story = context.storyId ? getStory(context.storyId) : undefined
    const feature =
      context.storyId && context.featureId
        ? getFeature(context.storyId, context.featureId)
        : undefined
    return {
      project: project
        ? { id: project.id, title: project.title, description: project.description }
        : undefined,
      story: story
        ? {
            id: story.id,
            title: story.title,
            description: story.description,
            features: story.features,
          }
        : undefined,
      feature: feature
        ? { id: feature.id, title: feature.title, description: feature.description }
        : undefined,
    }
  }, [context.storyId, context.featureId, project, getStory, getFeature])
  const effectivePrompt = useMemo(
    () => (template ? interpolatePrompt(template, promptVariables) : ''),
    [template, promptVariables],
  )

  // Always surface the interpolated system prompt as a leading synthetic system
  // bubble (MessageList pins it as the collapsible SystemPromptBubble). Prepending
  // unconditionally — not only when empty — keeps it mounted across the first
  // send, so the canvas no longer jumps when the chat goes from empty to its
  // first message.
  const messagesWithSystem = useMemo(() => {
    const isFR = context.type === 'FEATURE_REQUEST'
    // A FEATURE_REQUEST chat renders its request as a centered panel (emptyStateContent), not a
    // chat message — hide the seeded `user` intro (the only user-role message; the in-place run
    // adds only assistant/tool) and skip the system-prompt bubble so the panel is the sole focus.
    const original = isFR
      ? (chat?.messages ?? []).filter((m) => m.role !== 'user')
      : (chat?.messages ?? [])
    if (!effectivePrompt || isFR) return original
    return [
      {
        role: 'system' as const,
        content: effectivePrompt,
        startedAt: '',
        completedAt: '',
        durationMs: 0,
      },
      ...original,
    ]
  }, [chat?.messages, effectivePrompt, context.type])

  const isAgentRunChat = context.type === 'AGENT_RUN_STORY' || context.type === 'AGENT_RUN_FEATURE'
  // A FEATURE_REQUEST chat hosts its accepted run in-place, so while that run is live it is
  // read-only just like an agent-run chat.
  const isFeatureRequestChat = context.type === 'FEATURE_REQUEST'
  const isRunningAgent =
    (isAgentRunChat || isFeatureRequestChat) &&
    (chat?.state === 'created' || chat?.state === 'running')

  // Receiver-side FEATURE_REQUEST chat: while the request is still pending, the composer is
  // replaced by an Accept/Reject bar (the request itself is the transcript's opening message).
  const { requestById, accept, reject } = useCrossProjectRequests()
  const featureRequest =
    context.type === 'FEATURE_REQUEST' && context.featureRequestId
      ? requestById(context.featureRequestId)
      : undefined
  // A FEATURE_REQUEST chat with an empty transcript is awaiting the operator's accept/reject — show
  // the centered request panel and hide the composer. Gated on the (synchronous) empty transcript
  // rather than the async request record, so the composer never flashes before the record loads.
  const awaitingFeatureRequest =
    isFeatureRequestChat && !isRunningAgent && messagesWithSystem.length === 0
  const [decisionBusy, setDecisionBusy] = useState(false)
  const onAcceptRequest = useCallback(async () => {
    if (!featureRequest) return
    setDecisionBusy(true)
    try {
      await accept(featureRequest.id)
    } finally {
      setDecisionBusy(false)
    }
  }, [accept, featureRequest])
  const onRejectRequest = useCallback(async () => {
    if (!featureRequest) return
    setDecisionBusy(true)
    try {
      await reject(featureRequest.id)
    } finally {
      setDecisionBusy(false)
    }
  }, [reject, featureRequest])

  // Suggested actions = the last assistant message's `suggestedActions` (chip
  // row above the input). Only shown when the chat isn't currently streaming
  // — mirrors desktop's `suggestedActions` derivation in `ChatSidebar`.
  const suggestedActions = useMemo<string[] | undefined>(() => {
    if (liveState.isSending) return undefined
    const msgs = chat?.messages ?? []
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role !== 'assistant') continue
      const sa = (m as unknown as { suggestedActions?: string[] }).suggestedActions
      if (Array.isArray(sa)) return sa.filter((s): s is string => typeof s === 'string')
      return undefined
    }
    return undefined
  }, [chat?.messages, liveState.isSending])

  // ---- Draft (controlled input value mirrored from the ChatsContext ref) --
  const [draft, setDraftState] = useState<string>(() => getDraft(context))
  // Pending attachment paths — ephemeral, reset alongside the draft when the
  // active chat changes.
  const [attachments, setAttachments] = useState<string[]>([])
  const lastKeyRef = useRef<string>(contextKey)
  if (lastKeyRef.current !== contextKey) {
    lastKeyRef.current = contextKey
    setDraftState(getDraft(context))
    setAttachments([])
  }
  const onInputChange = useCallback(
    (next: string) => {
      setDraftState(next)
      setDraft(context, next)
    },
    [context, setDraft],
  )

  // ---- Send / abort / confirm --------------------------------------------
  const [scrollSignal, setScrollSignal] = useState(0)
  const onSend = useCallback(
    async (content: string, sentAttachments?: string[]) => {
      // Optimistic clear — the textarea blanks immediately so the user sees
      // the send go through. If `sendMessage` rejects, the live state's
      // sendError banner surfaces the error.
      clearDraft(context)
      setDraftState('')
      setAttachments([])
      setScrollSignal((s) => s + 1)
      await sendMessage(context, content, sentAttachments)
    },
    [clearDraft, context, sendMessage],
  )
  const onAbort = useCallback(() => {
    if (chat && isAgentRunChat) return cancelRun(chat)
    return abortChat(context)
  }, [abortChat, cancelRun, chat, context, isAgentRunChat])
  const onConfirmTools = useCallback(
    (ids: string[]) => confirmTools(context, ids),
    [confirmTools, context],
  )
  const onCancelToolConfirmation = useCallback(
    () => cancelToolConfirmation(context),
    [cancelToolConfirmation, context],
  )
  const onDeleteLastMessage = useCallback(
    () => deleteLastMessage(context),
    [deleteLastMessage, context],
  )

  // ---- Inline @ file mentions / # references in rendered messages -------
  const filesByPath = useMemo(() => {
    const map: Record<string, (typeof files)[number]> = {}
    for (const f of files) {
      if (f.relativePath) map[f.relativePath] = f
      if (f.absolutePath) map[f.absolutePath] = f
    }
    return map
  }, [files])
  const navigateToResource = useNavigateToResource()
  const onResolveFile = useCallback(
    (token: string) => {
      const exact = filesByPath[token]
      if (exact) return exact
      // Loose match against the trailing filename.
      const short = token.split('/').pop() || token
      return filesByPath[short] ?? null
    },
    [filesByPath],
  )
  const renderDependency = useCallback(
    (dep: string) => {
      // dep is "#3" or "#3.2" or "#storyId" — strip the leading hash.
      const raw = dep.startsWith('#') ? dep.slice(1) : dep
      const [s, f] = raw.split('.')
      const story = getStory(s)
      const feature = f && story ? getFeature(story.id, f) : undefined
      const label = feature ? `${story?.title ?? s} / ${feature.title}` : (story?.title ?? raw)
      return (
        <span
          className="inline rounded-sm px-1 py-px border border-(--border-subtle) bg-(--surface-overlay) text-(--text-secondary) text-[12px]"
          title={label}
        >
          #{raw}
        </span>
      )
    },
    [getStory, getFeature],
  )

  // ---- # references (stories + features) for the input ------------------
  const onSearchReferences = useCallback(
    (token: string) => {
      const t = token.trim().toLowerCase()
      const out: { value: string; label: string; description?: string }[] = []
      for (const s of stories) {
        const sIdx = storyDisplayIndex(s.id)
        const sLabel = sIdx != null ? `${sIdx} · ${s.title}` : s.title
        if (
          !t ||
          s.title.toLowerCase().includes(t) ||
          (sIdx != null && String(sIdx).startsWith(t))
        ) {
          out.push({
            value: sIdx != null ? String(sIdx) : s.id,
            label: sLabel,
            description: 'Story',
          })
        }
        for (const f of s.features ?? []) {
          const fIdx = featureDisplayIndex(s.id, f.id)
          const refValue = sIdx != null && fIdx != null ? `${sIdx}.${fIdx}` : `${s.id}.${f.id}`
          const fLabel = `${refValue} · ${f.title}`
          if (!t || f.title.toLowerCase().includes(t) || refValue.toLowerCase().startsWith(t)) {
            out.push({ value: refValue, label: fLabel, description: `Feature in ${s.title}` })
          }
        }
        if (out.length >= 50) break
      }
      return out.slice(0, 8)
    },
    [stories, storyDisplayIndex, featureDisplayIndex],
  )

  // ---- File attachment ---------------------------------------------------
  const onUploadAttachment = useCallback(
    async (file: File): Promise<string | undefined> => {
      const reader = new FileReader()
      const text: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
        reader.onload = () => resolve((reader.result as string) ?? '')
        reader.readAsText(file)
      })
      const path = await uploadFile(file.name, { content: text })
      return path ?? undefined
    },
    [uploadFile],
  )

  // ---- Read receipts -----------------------------------------------------
  const onAtBottomChange = useCallback(
    (atBottom: boolean) => {
      if (!atBottom) return
      markChatSeen(context)
      markReadByContext(context)
    },
    [context, markChatSeen, markReadByContext],
  )
  const onReadLatest = useCallback(
    (iso?: string) => {
      if (!iso) return
      markChatSeen(context)
      markReadByContext(context, iso)
    },
    [context, markChatSeen, markReadByContext],
  )

  // Clear notifications when landing on this chat (matches desktop's
  // `clearChatNotifications`).
  useEffect(() => {
    markChatSeen(context)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey])

  const inputOverride = isRunningAgent ? (
    <div
      className="flex items-center justify-between gap-2 px-4 py-3 border-t text-xs shrink-0"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full animate-ping"
          style={{ background: 'var(--accent-primary)' }}
        />
        <span>Agent is running. Chat is read-only.</span>
      </div>
      {chat && isAgentRunChat ? (
        <Button size="sm" variant="ghost" onClick={() => void cancelRun(chat)}>
          Cancel run
        </Button>
      ) : null}
    </div>
  ) : undefined

  // While pending, the Accept/Reject action lives in the centered intro panel (below), so the
  // composer is disabled rather than replaced.
  const featureRequestEmptyState = awaitingFeatureRequest ? (
    <FeatureRequestIntroPanel
      fromProjectId={featureRequest?.requestedBy.fromProjectId}
      title={featureRequest?.title ?? chat?.title}
      description={featureRequest?.description}
      cycle={featureRequest?.cycleFlag?.detected}
      onAccept={() => void onAcceptRequest()}
      onReject={() => void onRejectRequest()}
      busy={decisionBusy}
    />
  ) : undefined

  return (
    <ChatBody
      chatId={contextKey}
      header={header}
      sendError={liveState.sendError ? { message: liveState.sendError.message } : null}
      messages={messagesWithSystem}
      liveState={liveState}
      renderToolResult={renderToolCall}
      getToolHeaderPath={getToolHeaderPath}
      onResolveFile={onResolveFile}
      renderDependency={renderDependency}
      onResourceLink={navigateToResource}
      renderCliRunArtifact={
        context.projectId
          ? (runId) => (
              <CliRunArtifactPanel key={runId} runId={runId} projectId={context.projectId!} />
            )
          : undefined
      }
      onSend={onSend}
      onAbort={onAbort}
      onConfirmTools={onConfirmTools}
      onCancelToolConfirmation={onCancelToolConfirmation}
      previewTool={
        context.projectId ? (_id, toolName, args) => previewTool(toolName, args) : undefined
      }
      onDeleteLastMessage={onDeleteLastMessage}
      canSend={activeLLMConfig !== null}
      hideInput={awaitingFeatureRequest}
      emptyStateContent={featureRequestEmptyState}
      numberMessagesToSend={completionSettings?.numberMessagesToSend}
      lastReadIso={lastReadIso}
      onAtBottomChange={onAtBottomChange}
      onReadLatest={onReadLatest}
      scrollToBottomSignal={scrollSignal}
      inputOverride={inputOverride}
      inputValue={draft}
      onInputChange={onInputChange}
      inputProps={{
        filePaths: paths,
        attachments,
        onChangeAttachments: setAttachments,
        onSearchReferences,
        onUploadAttachment,
        suggestedActions,
        placeholder: inputProps?.placeholder,
        autoFocus: inputProps?.autoFocus,
        restoreKey: contextKey,
      }}
    />
  )
}
