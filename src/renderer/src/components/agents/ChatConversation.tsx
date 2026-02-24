import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react'
import RichText from '../ui/RichText'
import type { ToolCall, AgentRunHistory, AgentRunConversation, CompletionMessage, CompletionToolMessage } from 'thefactory-tools'
import { formatHmsCompact } from '../../utils/time'
import Code from '../ui/Code'
import { IconChat } from '../ui/icons/Icons'

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
        className='w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
        onClick={() => setOpen((v) => !v)}
      >
        <span className='text-xs font-medium truncate pr-2'>{title}</span>
        <span className='text-xs text-neutral-500'>{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className={`${innerClassName ?? ''} border-t border-neutral-200 dark:border-neutral-800`}>
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
    <div className='rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40'>
      <div className='px-3 py-2 flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='text-xs font-semibold'>
            {index + 1}. {name}
          </div>
        </div>
      </div>
      <div className='px-3 pb-2'>
        <Collapsible title={<span>View arguments</span>}>
          <Code language='json' code={JSON.stringify(args, null, 2)} />
        </Collapsible>
      </div>
      {displayResult ? (
        <div className='px-3 pb-3'>
          <Collapsible title={<span>View result</span>}>
            <Code language='json' code={typeof displayResult === 'string' ? displayResult : String(displayResult)} />
          </Collapsible>
        </div>
      ) : null}
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
      <div className='rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words'>
        <RichText text={text} />
      </div>
    </div>
  )
}

type TurnMessages = {
  assistant: CompletionMessage
  tools: CompletionToolMessage[]
  index: number
}

function buildFeatureTurns(messages: CompletionMessage[]) {
  const turns: TurnMessages[] = []
  if (!messages || messages.length === 0)
    return { initial: undefined as CompletionMessage | undefined, turns }

  const initial = messages[0]

  for (const m of messages) {
    if ((m as any).role === 'assistant') {
      turns.push({ assistant: m, tools: [], index: turns.length + 1 })
      continue
    }
    if ((m as any).role === 'tool' && turns.length > 0) {
      turns[turns.length - 1].tools.push(m as any)
    }
  }
  return { initial, turns }
}

function AssistantBubble({ title, text }: { title?: string; text: string }) {
  return (
    <div className='max-w-[80%] rounded-2xl px-3 py-2 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 shadow-sm'>
      {title ? <div className='text-[11px] font-medium mb-1'>{title}</div> : null}
      {isLargeText(text) ? (
        <ScrollableTextBox text={text} />
      ) : (
        <div className='text-xs whitespace-pre-wrap break-words'>
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
  const { initial, turns } = buildFeatureTurns((conversation.messages || []) as any)

  return (
    <div className='space-y-2 p-1'>
      {initial ? (
        <Collapsible title={<span className='flex items-center1'>Initial prompt</span>} defaultOpen={false}>
          {isLargeText((initial as any).content) ? (
            <ScrollableTextBox text={String((initial as any).content || '')} />
          ) : (
            <div className='p-2 text-xs whitespace-pre-wrap break-words'>
              <RichText text={String((initial as any).content || '')} />
            </div>
          )}
        </Collapsible>
      ) : (
        <div className='text-sm text-neutral-500'>No conversation yet.</div>
      )}

      {turns.map((t, idx) => {
        const toolCalls: ToolCall[] = (t.tools || []).map((m) => (m as any).toolCall).filter(Boolean)
        const toolResults = (t.tools || []).map((m) => (m as any).toolResult?.result)

        const isLatestTurn = idx === turns.length - 1
        const defaultOpen = isLatestFeature && isLatestTurn

        return (
          <div key={idx} ref={defaultOpen && latestTurnRef ? latestTurnRef : undefined}>
            <Collapsible
              innerClassName='p-2'
              title={<span className='flex items-center gap-2'>{`Turn ${idx + 1}`}</span>}
              defaultOpen={defaultOpen}
            >
              <div className='space-y-2'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <AssistantBubble title='Assistant' text={String((t.assistant as any).content || '')} />
                  </div>
                  <div className='flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap mt-1'>
                    {formatHmsCompact((t.assistant as any).durationMs || 0)}
                  </div>
                </div>

                {toolCalls.length > 0 && (
                  <div className='space-y-2'>
                    {toolCalls.map((call, i) => (
                      <ToolCallRow key={i} call={call} index={i} result={toolResults[i]} />
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

  const latestFeature = run.conversations.length > 0 ? run.conversations[run.conversations.length - 1] : undefined
  const latestFeatureId = latestFeature?.featureId

  const isStoryOnlyRun = useMemo(() => {
    const first = run.conversations?.[0]
    return !!first && !first.featureId
  }, [run.conversations])

  const isRunActive = run.state === 'created' || run.state === 'running'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const threshold = 40
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
      stickToBottomRef.current = atBottom
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const contentSize = useMemo(() => {
    let count = 0
    for (const c of run.conversations) count += c.messages.length
    return count + ':' + run.conversations.length
  }, [run.conversations])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight })
    }
  }, [contentSize])

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

  const openStoryRunChat = () => {
    const projectId = encodeURIComponent(run.projectId)
    const storyId = encodeURIComponent(run.storyId)
    const agentRunId = encodeURIComponent(run.id)
    window.location.hash = `#chat/agent-run/${projectId}/${storyId}/${agentRunId}`
  }

  const openFeatureRunChat = (featureId: string) => {
    const projectId = encodeURIComponent(run.projectId)
    const storyId = encodeURIComponent(run.storyId)
    const fId = encodeURIComponent(featureId)
    const agentRunId = encodeURIComponent(run.id)
    window.location.hash = `#chat/agent-run-feature/${projectId}/${storyId}/${fId}/${agentRunId}`
  }

  return (
    <div className='flex flex-col gap-2'>
      <ul
        ref={containerRef}
        className='h-[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3'
        role='log'
        aria-live='polite'
      >
        {run.conversations.length === 0 ? (
          <div className='text-sm text-neutral-500'>No conversations to display.</div>
        ) : (
          <>
            {run.conversations.map((conversation) => {
              const start = new Date(conversation.createdAt)
              const end = conversation.finishedAt ? new Date(conversation.finishedAt) : undefined
              const subtitle = [start ? start.toLocaleString() : null, end ? `→ ${end.toLocaleString()}` : null]
                .filter(Boolean)
                .join(' ')
              const isLatestFeature = conversation.featureId === latestFeatureId

              const isStoryConversation = !conversation.featureId
              const titleNode = (
                <span className='flex items-center gap-2'>
                  {!isRunActive && isStoryConversation ? (
                    isStoryOnlyRun ? (
                      <span
                        role='button'
                        title='Open story run chat'
                        aria-label='Open story run chat'
                        className='btn-secondary btn-icon inline-flex'
                        onClick={(e) => {
                          e.stopPropagation()
                          openStoryRunChat()
                        }}
                      >
                        <IconChat className='w-4 h-4' />
                      </span>
                    ) : null
                  ) : !isRunActive && conversation.featureId ? (
                    <span
                      role='button'
                      title='Open feature run chat'
                      aria-label='Open feature run chat'
                      className='btn-secondary btn-icon inline-flex'
                      onClick={(e) => {
                        e.stopPropagation()
                        openFeatureRunChat(conversation.featureId!)
                      }}
                    >
                      <IconChat className='w-4 h-4' />
                    </span>
                  ) : null}
                  <span>
                    {isStoryConversation ? 'Story Run' : `Feature: ${conversation.featureId}`}
                    {subtitle ? <span className='text-neutral-500 text-[11px] px-2'> {subtitle}</span> : null}
                  </span>
                </span>
              )

              return (
                <li key={conversation.id}>
                  <Collapsible title={titleNode} defaultOpen={isLatestFeature}>
                    <FeatureContent
                      conversation={conversation as any}
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
    </div>
  )
}
