import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import RichText from '../ui/RichText'
import SafeText from '../ui/SafeText'
import type {
  AgentResponse,
  ToolCall,
  AgentRunHistory,
  AgentRunConversation,
  ChatMessage,
  ToolResult,
} from 'thefactory-tools'
import { formatHmsCompact } from '../../utils/time'
import Code from '../ui/Code'
import JsonView from '../ui/JsonView'

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

function ToolCallRow({ call, result, index }: { call: ToolCall; result?: any; index: number }) {
  const name = call.name
  const args = call.arguments ?? {}
  const displayResult =
    result && typeof result !== 'string'
      ? JSON.stringify(JSON.parse(JSON.stringify(result)), null, 2)
      : result

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">
            {index + 1}. {name}
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <Collapsible title={<span>View arguments</span>}>
          <Code language="json" code={JSON.stringify(args, null, 2)} />
        </Collapsible>
      </div>
      {displayResult && (
        <div className="px-3 pb-3">
          <Collapsible title={<span>View result</span>}>
            <Code language="json" code={displayResult} />
          </Collapsible>
        </div>
      )}
    </div>
  )
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

type TurnMessages = {
  assistant: ChatMessage
  toolResults?: ToolResult[]
  index: number
}

function buildFeatureTurns(messages: ChatMessage[]) {
  const turns: TurnMessages[] = []
  if (!messages || messages.length === 0)
    return { initial: undefined as ChatMessage | undefined, turns }

  const initial = messages[0]

  for (const m of messages) {
    if (m.completionMessage.role === 'assistant') {
      turns.push({ assistant: m, index: turns.length + 1 })
      continue
    }
    if (turns.length > 0) {
      turns[turns.length - 1] = { ...turns[turns.length - 1], toolResults: m.toolResults }
    }
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

function FeatureContent({
  conversation,
  isLatestFeature,
  latestTurnRef,
}: {
  conversation: AgentRunConversation
  isLatestFeature: boolean
  latestTurnRef?: React.RefObject<HTMLDivElement | null>
}) {
  // const { initial, turns } = useMemo(
  //   () => buildFeatureTurns(conversation.messages || []),
  //   [conversation.messages],
  // )
  const { initial, turns } = buildFeatureTurns(conversation.messages || [])

  return (
    <div className="space-y-2 p-1">
      {initial ? (
        <Collapsible
          title={<span className="flex items-center1">Initial prompt</span>}
          defaultOpen={false}
        >
          {isLargeText(initial.completionMessage.content) ? (
            <ScrollableTextBox text={initial.completionMessage.content} />
          ) : (
            <div className="p-2 text-xs whitespace-pre-wrap break-words">
              <RichText text={initial.completionMessage.content} />
            </div>
          )}
        </Collapsible>
      ) : (
        <div className="text-sm text-neutral-500">No conversation yet.</div>
      )}

      {turns.map((t, idx) => {
        const toolCalls: ToolCall[] = t.assistant.toolCalls ?? []
        const toolResults = t.toolResults ?? []

        const isLatestTurn = idx === turns.length - 1
        const defaultOpen = isLatestFeature && isLatestTurn

        return (
          <div key={idx} ref={defaultOpen && latestTurnRef ? latestTurnRef : undefined}>
            <Collapsible
              innerClassName="p-2"
              title={<span className="flex items-center gap-2">{`Turn ${idx + 1}`}</span>}
              defaultOpen={defaultOpen}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <AssistantBubble
                      title="Assistant"
                      text={t.assistant.completionMessage.content}
                    />
                  </div>
                  <div className="flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap mt-1">
                    {formatHmsCompact(t.assistant.completionMessage.durationMs)}
                  </div>
                </div>

                {toolCalls.length > 0 && (
                  <div className="space-y-2">
                    {toolCalls.map((call, i) => {
                      return (
                        <ToolCallRow
                          key={i}
                          call={call}
                          index={i}
                          result={toolResults[i]?.result}
                        />
                      )
                    })}
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
    el.addEventListener('scroll', onScroll, { passive: true })
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
            const start = new Date(conversation.createdAt)
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
