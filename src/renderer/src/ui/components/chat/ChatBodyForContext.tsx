import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigateToResource } from '@ui/hooks/useNavigateToResource'
import { useNavigateToGroupRun } from '@ui/hooks/useNavigateToGroupRun'
import { useNavigate } from 'react-router-dom'
import {
  ChatBody,
  CliRunArtifactPanel,
  IncomingFeatureRequestCard,
  ModelChipConnected,
  ProcessGroupRunChip,
  ProcessRunChip,
  interpolatePrompt,
  type ChatBodyProps,
  type PromptVariables,
  arrayBufferToBase64,
  useReferenceRenderer,
} from 'thefactory-ui/web'
import type { ChatContext } from 'thefactory-ui/headless/api'
import {
  featureRequestChatContext,
  useAgents,
  useChatComposer,
  useCrossProjectRequests,
  useOpenChat,
} from 'thefactory-ui/headless'
import { useChats } from 'thefactory-ui/headless'
import { chatClosure } from 'thefactory-ui/headless'
import { useCredentialCaptures } from 'thefactory-ui/headless'
import {
  FEATURE_REQUEST_COMPOSER_HINT,
  hiddenFeatureRequestIntro,
  useIncomingFeatureRequest,
} from 'thefactory-ui/headless'
import { useFiles } from 'thefactory-ui/headless'
import { usePendingToolGrants } from 'thefactory-ui/headless'
import { useTools } from 'thefactory-ui/headless'
import {
  buildChatPromptVariables,
  formatChatTitle,
  useProjectsGroups,
  useReferences,
  useStories,
} from 'thefactory-ui/headless'
import { useProcessRuns } from 'thefactory-ui/headless'
import { useActiveProject } from 'thefactory-ui/headless'
import { getChatContextKey } from '@core/chats/chatKey'
import { fetchAttachmentPreviewUrl } from '@core/chats/attachmentPreviewUrl'
import { useAuth } from '@core/contexts/AuthContext'
import { markChatSeen } from '@core/notifications/useBadgeCounts'
import { useChatContextLastRead as useChatLastRead } from 'thefactory-ui/web'
import { Button, StartWorkDialog } from 'thefactory-ui/web'
import { useFeatureRequestStart, useProjectWorkLaunch } from 'thefactory-ui/headless'
import { getToolHeaderPath, renderToolCall } from './ToolCall/renderers'
import FeatureRequestFullModal from './FeatureRequestFullModal'

export type ChatBodyForContextProps = {
  context: ChatContext
  /** Caller-rendered header slot. */
  header?: ReactNode
  /** Pass-through for placeholder + autoFocus. */
  inputProps?: Pick<NonNullable<ChatBodyProps['inputProps']>, 'autoFocus' | 'placeholder'>
  /**
   * The way back to the pipeline, when this chat is shown INSIDE it (a leaf
   * drill). Every "Back to pipeline" here then returns to the spine; without it
   * they navigate to the process run's route, which is right in the Chat tab but
   * does nothing under a drill already showing that run.
   */
  onBackToPipeline?: () => void
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
  onBackToPipeline,
}: ChatBodyForContextProps) {
  const {
    activeLLMConfig,
    getChatLiveState,
    restartLastTurn,
    abortChat,
    deleteLastMessage,
    uploadAttachment,
    getEffectiveChatSettings,
  } = useChats()
  const { cancelRun } = useAgents()
  const { paths, files } = useFiles()
  const { previewTool } = useTools()
  const { project } = useActiveProject()
  const { getStory, getFeature, storyDisplayIndex, featureDisplayIndex } = useStories()
  const { lastReadIso, markReadByContext } = useChatLastRead(context)

  // The chat with its messages — the chats list holds only its summary.
  const { chat, loading: messagesLoading } = useOpenChat(context)
  const liveState = getChatLiveState(context)
  const contextKey = getChatContextKey(context)

  // Gated-action approvals for a CLI-backed chat. The unified grants drive the
  // inline approval panel (and the several-at-once modal).
  //
  // Deliberately NOT gated on a run id. A gated call no longer holds its run
  // open while it waits: the agent raises the ask, the call comes back pending
  // and the turn ENDS, so the run goes terminal within seconds while the
  // approval is still pending and decidable. Gating on `cliRunId` threw the
  // grants away at exactly that moment and the approval banner vanished out
  // from under the user. The hook already scopes these to THIS chat and returns
  // only real pending tool grants, so there is nothing left to gate on.
  // `cliRunId` is still used for abort + the transcript view; it just no longer
  // gates the grants.
  const { grants, cliRunId, isRunActive } = usePendingToolGrants(
    context,
    liveState.cliRunId ?? undefined,
  )

  // In-chat credential capture: an agent that needs a secret opens a form here
  // rather than asking for it in the transcript.
  const { captures, submit: submitCapture, cancel: cancelCapture } = useCredentialCaptures(context)

  // ---- Effective system prompt (interpolated) -----------------------------
  const effectiveSettings = useMemo(
    () => getEffectiveChatSettings(context),
    [context, getEffectiveChatSettings],
  )
  const template = effectiveSettings.systemPrompt ?? ''
  const completionSettings = effectiveSettings.completionSettings
  // The same variables a sent turn is given, so the bubble shows the prompt the agent reads.
  const { getGroupById } = useProjectsGroups()
  const promptVariables = useMemo<PromptVariables>(
    () =>
      buildChatPromptVariables(context, {
        ...(project
          ? {
              project: { id: project.id, title: project.title, description: project.description },
            }
          : {}),
        getStory,
        getFeature,
        getGroupById,
      }),
    [context, project, getStory, getFeature, getGroupById],
  )
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
    // A FEATURE_REQUEST chat opens with its request as a card above the conversation, not as a
    // chat message — hide the seeded intro and skip the system-prompt bubble so the card leads.
    const original = hiddenFeatureRequestIntro(chat?.messages ?? [], isFR)
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
  // A one-shot agent run (implement / verify / report) takes NO user input — once
  // it is terminal the composer must not appear. Its way onward is the pipeline,
  // not a reply, so the composer slot carries a link back to the story's process.
  const isTerminalAgentRun = isAgentRunChat && !isRunningAgent
  const { runs: projectProcessRuns } = useProcessRuns(context.projectId)
  const storyProcessRun =
    isAgentRunChat && context.storyId
      ? projectProcessRuns.find((r) => r.storyId === context.storyId)
      : undefined

  // Receiver-side FEATURE_REQUEST chat: the request is the conversation's opening card, and while
  // it waits for a decision the composer only says so. Until the record loads, an empty transcript
  // stands for "still waiting", so the composer never flashes open first.
  const incomingRequest = useIncomingFeatureRequest(
    context.type === 'FEATURE_REQUEST' ? context.featureRequestId : undefined,
  )
  const featureRequest = incomingRequest.request
  const crossProjectRequests = useCrossProjectRequests()
  const awaitingFeatureRequest =
    isFeatureRequestChat &&
    (featureRequest ? featureRequest.status === 'pending' : messagesWithSystem.length === 0)
  const [fullRequestId, setFullRequestId] = useState<string>()

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

  // ---- Send / abort / confirm --------------------------------------------
  const [scrollSignal, setScrollSignal] = useState(0)
  const canonicalizeRef = useRef<(text: string) => string>((text) => text)
  // The chat's persisted draft — text, attachment chips, pending queue. A send
  // clears it at once and puts it back if the message does not reach the server.
  const composer = useChatComposer(context, {
    canonicalize: (text) => canonicalizeRef.current(text),
    onSent: () => setScrollSignal((s) => s + 1),
  })
  const attachments = composer.attachments
  const onInputChange = composer.setText
  const onSend = composer.send
  const onAbort = useCallback(() => {
    if (chat && isAgentRunChat) return cancelRun(chat)
    return abortChat(context, cliRunId)
  }, [abortChat, cancelRun, chat, cliRunId, context, isAgentRunChat])
  const onDeleteLastMessage = useCallback(
    () => deleteLastMessage(context),
    [deleteLastMessage, context],
  )
  // Withheld on an agent-run / live feature-request chat: those transcripts are
  // written by a run, not by chat sends, so re-triggering the chat agent on them
  // is not the same action at all.
  const onRestartTurn = useCallback(() => restartLastTurn(context), [restartLastTurn, context])

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
  const navigateToGroupRun = useNavigateToGroupRun()
  const navigate = useNavigate()
  const requestLaunch = useProjectWorkLaunch(featureRequest?.targetProjectId)
  const requestStart = useFeatureRequestStart(
    featureRequest,
    incomingRequest,
    (outcome) => {
      const targetProjectId = featureRequest?.targetProjectId
      if (!targetProjectId) return
      if (outcome.mode === 'process' && outcome.processRunId) {
        navigate(`/projects/${targetProjectId}/process-runs/${outcome.processRunId}`)
      } else if (outcome.chatContextId) {
        navigate(`/projects/${targetProjectId}/chat/${encodeURIComponent(outcome.chatContextId)}`)
      }
    },
    requestLaunch.chatAgent,
  )
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
  // ---- References: chips in messages, `#` / `&` in the input ------------
  const chatAttachmentPaths = useMemo(
    () => [
      ...new Set([
        ...(chat?.messages ?? []).flatMap((m) =>
          m.role === 'user' ? ((m as { files?: string[] }).files ?? []) : [],
        ),
        ...attachments,
      ]),
    ],
    [chat?.messages, attachments],
  )
  const references = useReferences({ scope: context, attachments: chatAttachmentPaths })
  // What was typed — `#3.2`, `&qa-login` — is sent as what it points at now.
  canonicalizeRef.current = references.canonicalize
  const renderReference = useReferenceRenderer({
    references,
    onResolveFile,
    onOpen: navigateToResource,
  })

  // ---- File attachment ---------------------------------------------------
  const onUploadAttachment = useCallback(
    async (file: File): Promise<string | undefined> =>
      uploadAttachment(context, file.name, arrayBufferToBase64(await file.arrayBuffer())),
    [uploadAttachment, context],
  )
  const { token, baseUrl } = useAuth()
  // A restored draft's image chips load their thumbnails from the project's
  // files; a group or general chat's attachments have no file route, so they
  // show the plain chip.
  const getAttachmentPreviewUrl = useCallback(
    (path: string) =>
      context.projectId && baseUrl
        ? fetchAttachmentPreviewUrl(baseUrl, context.projectId, path, token)
        : Promise.reject(new Error('No preview')),
    [baseUrl, context.projectId, token],
  )
  const dropTargetTitle = formatChatTitle({
    context,
    chatTitle: chat?.title,
    projectName: project?.title,
    groupName: context.groupId ? getGroupById(context.groupId)?.title : undefined,
    storyDisplayIndex,
    featureDisplayIndex,
  })

  // ---- Read receipts -----------------------------------------------------
  const onAtBottomChange = useCallback(
    (atBottom: boolean) => {
      if (!atBottom) return
      markChatSeen(context)
      markReadByContext(context)
    },
    [context, markReadByContext],
  )
  const onReadLatest = useCallback(
    (iso?: string) => {
      if (!iso) return
      markChatSeen(context)
      markReadByContext(context, iso)
    },
    [context, markReadByContext],
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
  ) : isTerminalAgentRun ? (
    // A finished one-shot run takes no input. The approval-panel branch outranks
    // inputOverride, so a still-pending tool-approval on a direct agent run is
    // never hidden behind it.
    <div
      className="flex items-center justify-between gap-2 px-4 py-3 border-t text-xs shrink-0"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-muted)' }}
    >
      {storyProcessRun ? (
        <>
          <span>This is one step of a process. Its outcome is decided in the pipeline.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              onBackToPipeline
                ? onBackToPipeline()
                : navigate(`/projects/${context.projectId}/process-runs/${storyProcessRun.id}`)
            }
          >
            Back to pipeline →
          </Button>
        </>
      ) : (
        <span>This run is finished.</span>
      )}
    </div>
  ) : undefined

  const placedStoryId = featureRequest?.handling?.storyId
  const featureRequestCard = featureRequest ? (
    <>
      <IncomingFeatureRequestCard
        request={featureRequest}
        fromLabel={incomingRequest.fromLabel}
        adopterLabels={incomingRequest.adopterLabels}
        defaultMode={requestLaunch.defaultMode}
        onAccept={requestStart.onAccept}
        onStartWork={requestStart.onStartWork}
        onStartAgain={requestStart.onStartAgain}
        onReject={(reason) => void incomingRequest.reject(reason)}
        onMarkDelivered={(input) => void incomingRequest.markDelivered(input)}
        onHandOver={(input) => void incomingRequest.handOver(input)}
        requestTitle={(id) => crossProjectRequests.requestById(id)?.title}
        onOpenRequest={(id) => {
          const other = crossProjectRequests.requestById(id)
          if (other) navigateToResource({ kind: 'chat', context: featureRequestChatContext(other) })
        }}
        busy={incomingRequest.busy}
        error={incomingRequest.error}
        placedOn={
          incomingRequest.placedOnLabel && placedStoryId
            ? {
                label: incomingRequest.placedOnLabel,
                onOpen: () =>
                  navigateToResource({
                    kind: 'story',
                    projectId: featureRequest.targetProjectId,
                    storyId: placedStoryId,
                  }),
              }
            : undefined
        }
        onOpenFull={() => setFullRequestId(featureRequest.id)}
      />
      <StartWorkDialog
        start={requestStart.start}
        defaultMode={requestLaunch.defaultMode}
        chatRunner={requestLaunch.chatRunner}
      />
    </>
  ) : undefined

  return (
    <>
      <ChatBody
        chatId={contextKey}
        {...(context.projectId ? { projectId: context.projectId } : {})}
        {...(context.groupId ? { groupId: context.groupId } : {})}
        historyLocked={chatClosure(chat).locked}
        header={header}
        sendError={liveState.sendError ? { message: liveState.sendError.message } : null}
        messages={messagesWithSystem}
        messagesLoading={messagesLoading}
        {...(chat?.metadata ? { chatMetadata: chat.metadata } : {})}
        liveState={liveState}
        renderToolResult={renderToolCall}
        getToolHeaderPath={getToolHeaderPath}
        onResolveFile={onResolveFile}
        renderReference={renderReference}
        onResourceLink={navigateToResource}
        renderCliRunReview={
          context.projectId
            ? (runId, review) => (
                <CliRunArtifactPanel
                  key={runId}
                  framed={false}
                  runId={runId}
                  projectId={context.projectId!}
                  onSendMessage={(text) => onSend(text, [])}
                  onDraftMessage={review.draftMessage}
                  onOpenGit={() => navigate(`/projects/${context.projectId}/git`)}
                  onBackToPipeline={(id) =>
                    onBackToPipeline
                      ? onBackToPipeline()
                      : navigate(`/projects/${context.projectId}/process-runs/${id}`)
                  }
                />
              )
            : undefined
        }
        renderProcessGroupRun={(groupRunId) => (
          <ProcessGroupRunChip
            groupRunId={groupRunId}
            onOpen={(id) => navigateToGroupRun(id, context.groupId)}
          />
        )}
        renderProcessRun={(processRunId) => (
          <ProcessRunChip
            processRunId={processRunId}
            onOpen={(id, runProjectId) => navigate(`/projects/${runProjectId}/process-runs/${id}`)}
          />
        )}
        renderApprovalModelChip={({
          model,
          onPick,
          cli,
          onPickCli,
          api,
          onPickApi,
          effort,
          onPickEffort,
        }) => (
          <ModelChipConnected
            chatContext={context}
            editable
            overrideModel={model}
            onOverrideModel={onPick}
            overrideCli={cli}
            onOverrideCli={onPickCli}
            overrideApi={api}
            onOverrideApi={onPickApi}
            overrideEffort={effort}
            onOverrideEffort={onPickEffort}
          />
        )}
        onSend={onSend}
        onAbort={onAbort}
        isBusy={liveState.isSending || isRunActive}
        activeCliRunId={cliRunId}
        previewTool={
          context.projectId ? (_id, toolName, args) => previewTool(toolName, args) : undefined
        }
        grants={grants}
        credentialCaptures={captures}
        onSubmitCredentialCapture={submitCapture}
        onCancelCredentialCapture={cancelCapture}
        onDeleteLastMessage={isAgentRunChat || isRunningAgent ? undefined : onDeleteLastMessage}
        onRestartTurn={isAgentRunChat || isRunningAgent ? undefined : onRestartTurn}
        canSend={activeLLMConfig !== null && !awaitingFeatureRequest}
        leadingContent={featureRequestCard}
        numberMessagesToSend={completionSettings?.numberMessagesToSend}
        lastReadIso={lastReadIso}
        onAtBottomChange={onAtBottomChange}
        onReadLatest={onReadLatest}
        scrollToBottomSignal={scrollSignal}
        inputOverride={inputOverride}
        inputValue={composer.text}
        onInputChange={onInputChange}
        pendingQueue={composer.queue}
        inputProps={{
          filePaths: paths,
          ...(references.searchFiles ? { searchFiles: references.searchFiles } : {}),
          describeFile: references.describeFile,
          attachments,
          onChangeAttachments: composer.setAttachments,
          onSearchReferences: references.searchWork,
          onSearchHandles: references.searchHandles,
          onUploadAttachment,
          onAddAttachment: composer.addAttachment,
          getAttachmentPreviewUrl,
          dropTargetTitle,
          suggestedActions,
          placeholder: awaitingFeatureRequest
            ? FEATURE_REQUEST_COMPOSER_HINT
            : inputProps?.placeholder,
          autoFocus: inputProps?.autoFocus,
          restoreKey: contextKey,
        }}
      />
      <FeatureRequestFullModal
        requestId={fullRequestId}
        onClose={() => setFullRequestId(undefined)}
      />
    </>
  )
}
