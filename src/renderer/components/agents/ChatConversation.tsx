import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import RichText from '../ui/RichText'
import SafeText from '../ui/SafeText'
import type {
  AgentResponse,
  ToolCall,
  AgentRunHistory,
  AgentRunConversation,
  AgentRunMessage,
} from 'thefactory-tools'

// Parse assistant JSON response to extract thoughts and tool calls safely
function parseAssistant(content: string): AgentResponse | null {
  try {
    const obj = JSON.parse(content)
    if (obj && typeof obj === 'object') return obj as AgentResponse
    return null
  } catch {
    return null
  }
}

function JsonPreview({ value, maxChars = 200 }: { value: any; maxChars?: number }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (str.length <= maxChars)
    return <pre className="text-xs whitespace-pre-wrap break-words">{str}</pre>
  const [open, setOpen] = useState(false)
  return (
    <div>
      <pre className="text-xs whitespace-pre-wrap break-words">
        {open ? str : str.slice(0, maxChars) + '\u2026'}
      </pre>
      <button className="btn-link text-xs mt-1" onClick={() => setOpen((v) => !v)}>
        {open ? 'Show less' : 'Show more'}
      </button>
    </div>
  )
}

function Collapsible({
  title,
  children,
  defaultOpen = false,
  className,
  innerClassName,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  innerClassName?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`${className ?? ''} border rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900`}
    >
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-neutral-500">{open ? '\u2212' : '+'}</span>
      </button>
      {open ? (
        <div
          className={`${innerClassName ?? ''} border-t border-neutral-200 dark:border-neutral-800`}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

function ToolCallRow({
  call,
  resultText,
  index,
}: {
  call: ToolCall
  resultText?: string
  index: number
}) {
  const name = call.tool_name
  const args = call.arguments ?? {}
  const isHeavy = name === 'read_files' || name === 'write_file'

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">
            {index + 1}. {name}
          </div>
          <div className="text-[11px] text-neutral-600 dark:text-neutral-400">Arguments</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        {isHeavy ? (
          <Collapsible title={<span>View arguments</span>}>
            <JsonPreview value={args} maxChars={500} />
          </Collapsible>
        ) : (
          <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 max-h-60 overflow-auto">
            <JsonPreview value={args} maxChars={400} />
          </div>
        )}
      </div>
      {resultText != null && (
        <div className="px-3 pb-3">
          <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Result</div>
          {isHeavy ? (
            <Collapsible title={<span>View result</span>}>
              <div className="text-xs whitespace-pre-wrap break-words">
                <SafeText text={resultText} />
              </div>
            </Collapsible>
          ) : (
            <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
              <SafeText text={resultText} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type ParsedToolResult = { name: string; result: any }

function parseToolResultsObjects(tools?: AgentRunMessage): ParsedToolResult[] {
  const text = tools?.content.trim() ?? '[]'
  try {
    return JSON.parse(text) as ParsedToolResult[]
  } catch {}
  return []
}

function isLargeText(text?: string) {
  if (!text) return false
  const len = text.length
  const lines = text.split(/\r?\n/).length
  return len > 800 || lines > 16
}

function ScrollableTextBox({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
        <RichText text={text} />
      </div>
    </div>
  )
}

function isToolMsg(m: AgentRunMessage | undefined) {
  if (!m) return false
  if (m.source === 'tools') return true
  return false
}

type TurnMessages = {
  assistant: AgentRunMessage
  tools?: AgentRunMessage
  index: number
  isFinal?: boolean
  thinkingTime?: number
}

function buildFeatureTurns(messages: AgentRunMessage[]) {
  const turns: TurnMessages[] = []
  if (!messages || messages.length === 0)
    return { initial: undefined as AgentRunMessage | undefined, turns }

  const initial = messages[0]

  let idx = 1
  let turn = 1
  let latestTurn: TurnMessages | undefined = undefined

  while (idx < messages.length) {
    const a = messages[idx]
    idx++

    if (a.role === 'assistant') {
      if (latestTurn) {
        turns.push(latestTurn)
        turn++
      }

      const askedAt = a.askedAt ? new Date(a.askedAt).getTime() : NaN
      const createdAt = a.completedAt ? new Date(a.completedAt).getTime() : NaN
      let thinkingTime: number | undefined = undefined
      if (!isNaN(askedAt) && !isNaN(createdAt)) {
        thinkingTime = Math.max(0, createdAt - askedAt)
      }

      latestTurn = { assistant: a, index: turn, thinkingTime }
      continue
    }

    if (latestTurn && isToolMsg(a)) {
      latestTurn.tools = a
    }
  }
  if (latestTurn) {
    latestTurn.isFinal = true
    turns.push(latestTurn)
  }
  return { initial, turns }
}

function AssistantBubble({ title, text }: { title?: string; text: string }) {
  return (
    <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 shadow-sm">
      {title ? <div className="text-[11px] font-medium mb-1">{title}</div> : null}
      {isLargeText(text) ? (
        <ScrollableTextBox text={text} />
      ) : (
        <div className="text-xs whitespace-pre-wrap break-words">
          <RichText text={text} />
        </div>
      )}
    </div>
  )
}

function UserBubble({ title, text }: { title?: string; text: string }) {
  return (
    <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50 shadow-sm">
      {title ? <div className="text-[11px] font-medium mb-1">{title}</div> : null}
      {isLargeText(text) ? (
        <ScrollableTextBox text={text} />
      ) : (
        <div className="text-xs whitespace-pre-wrap break-words">
          <RichText text={text} />
        </div>
      )}
    </div>
  )
}

function FeatureContent({
  conversation,
  isLatestFeature,
  latestTurnRef,
}: {
  conversation: AgentRunConversation
  isLatestFeature: boolean
  latestTurnRef?: React.RefObject<HTMLDivElement>
}) {
  // Recompute on every render to reflect in-place mutations of log.messages
  const { initial, turns } = buildFeatureTurns(conversation.messages || [])

  return (
    <div className="space-y-2 p-1">
      {initial ? (
        <Collapsible
          title={<span className="flex items-center1">Initial prompt</span>}
          defaultOpen={false}
        >
          {isLargeText(initial.content || '') ? (
            <ScrollableTextBox text={initial.content || ''} />
          ) : (
            <div className="p-2 text-xs whitespace-pre-wrap break-words">
              <RichText text={initial.content || ''} />
            </div>
          )}
        </Collapsible>
      ) : (
        <div className="text-sm text-neutral-500">No conversation yet.</div>
      )}

      {turns.map((t, idx) => {
        const parsed = parseAssistant(t.assistant.content)
        //TODO: if parsed is not AgentResponse - show some standard display
        const toolCalls: ToolCall[] = parsed?.tool_calls || []
        const resultsObjs = parseToolResultsObjects(t.tools)
        const hasThoughts = parsed?.thoughts && parsed.thoughts.trim().length > 0
        const isFinal = t.isFinal || toolCalls.length === 0

        const isLatestTurn = idx === turns.length - 1
        const defaultOpen = isLatestFeature && isLatestTurn

        return (
          <div key={idx} ref={defaultOpen && latestTurnRef ? latestTurnRef : undefined}>
            <Collapsible
              innerClassName="p-2"
              title={
                <span className="flex items-center gap-2">
                  {isFinal ? 'Final' : `Turn ${idx + 1}`}
                </span>
              }
              defaultOpen={defaultOpen}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {hasThoughts ? (
                      <AssistantBubble text={parsed!.thoughts!} />
                    ) : (
                      <AssistantBubble title="Assistant" text={t.assistant?.content || ''} />
                    )}
                  </div>
                  {t.thinkingTime != null && (
                    <div className="flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap mt-1">
                      {(t.thinkingTime / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>

                {toolCalls.length > 0 && (
                  <div className="space-y-2">
                    {toolCalls.map((call, i) => (
                      <ToolCallRow
                        key={i}
                        call={call}
                        index={i}
                        resultText={
                          resultsObjs[i]?.result
                            ? JSON.stringify(resultsObjs[i]?.result)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </Collapsible>
          </div>
        )
      })}
    </div>
  )
}

export default function ChatConversation({ run }: { run: AgentRunHistory }) {
  const containerRef = useRef<HTMLUListElement | null>(null)
  const stickToBottomRef = useRef(true)
  const latestTurnRef = useRef<HTMLDivElement | null>(null)
  const didInitialScrollRef = useRef(false)

  const latestFeature =
    run.conversations.length > 0 ? run.conversations[run.conversations.length - 1] : undefined
  const latestFeatureId = latestFeature?.featureId

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const threshold = 40 // px
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
      stickToBottomRef.current = atBottom
    }
    el.addEventListener('scroll', onScroll, { passive: true } as any)
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Compute a simple metric to detect new content
  const contentSize = useMemo(() => {
    let count = 0
    for (const c of run.conversations) count += c.messages.length
    return count + ':' + run.conversations.length
  }, [run.conversations])

  // Auto-scroll when new content arrives and user is at bottom
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [contentSize])

  // One-time scroll to the latest feature's latest turn on initial content render
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return
    const target = latestTurnRef.current
    if (target) {
      try {
        target.scrollIntoView({ block: 'nearest' })
        didInitialScrollRef.current = true
      } catch {}
    }
  }, [contentSize])

  return (
    <ul
      ref={containerRef}
      className="h-[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3"
      role="log"
      aria-live="polite"
    >
      {run.conversations.length === 0 ? (
        <div className="text-sm text-neutral-500">No conversations to display.</div>
      ) : (
        <>
          {run.conversations.map((conversation) => {
            const start = new Date(conversation.startedAt)
            const end = conversation.finishedAt ? new Date(conversation.finishedAt) : undefined
            const subtitle = [
              start ? start.toLocaleString() : null,
              end ? `→ ${end.toLocaleString()}` : null,
            ]
              .filter(Boolean)
              .join(' ')
            const isLatestFeature = conversation.featureId === latestFeatureId
            return (
              <li key={conversation.id}>
                <Collapsible
                  title={
                    <span className="flex items-center">
                      Feature: {conversation.featureId}
                      {subtitle ? (
                        <span className="text-neutral-500 text-[11px] px-3 py-2"> {subtitle}</span>
                      ) : null}
                    </span>
                  }
                  defaultOpen={isLatestFeature}
                >
                  <FeatureContent
                    conversation={conversation}
                    isLatestFeature={isLatestFeature}
                    latestTurnRef={isLatestFeature ? latestTurnRef : undefined}
                  />
                </Collapsible>
              </li>
            )
          })}
        </>
      )}
    </ul>
  )
}
