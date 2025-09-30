import React, { useMemo } from 'react'
import Tooltip from './Tooltip'
import type { ChatContext } from 'thefactory-tools'

function formatContext(context: ChatContext): React.ReactNode {
  const lines: string[] = []
  lines.push(`Type: ${context.type}`)
  if ('projectId' in context && context.projectId) lines.push(`Project: ${context.projectId}`)
  if ('storyId' in context && (context as any).storyId) lines.push(`Story: ${(context as any).storyId}`)
  if ('featureId' in context && (context as any).featureId)
    lines.push(`Feature: ${(context as any).featureId}`)
  if ('agentRunId' in context && (context as any).agentRunId)
    lines.push(`Agent Run: ${(context as any).agentRunId}`)
  if ('projectTopic' in context && (context as any).projectTopic)
    lines.push(`Topic: ${(context as any).projectTopic}`)
  return (
    <div className="text-xs leading-relaxed">
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  )
}

export default function ContextInfoButton({
  context,
  label,
  className,
}: {
  context: ChatContext
  label?: string
  className?: string
}) {
  const content = useMemo(() => formatContext(context), [context])

  return (
    <Tooltip content={content} placement="right">
      <button
        type="button"
        className={[
          'inline-flex items-center justify-center w-6 h-6 rounded-full',
          'border border-blue-500 text-blue-600 bg-transparent',
          'hover:bg-blue-50 dark:hover:bg-blue-900/20',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/50',
          'no-drag',
          className || '',
        ].join(' ')}
        aria-label={label || 'Chat context information'}
      >
        <span className="text-[11px] font-semibold">i</span>
      </button>
    </Tooltip>
  )
}
