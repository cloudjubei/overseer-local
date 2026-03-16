import type { Chat } from 'thefactory-tools'
import StatusChip from './StatusChip'

export default function AgentRunBullet({
  run,
  onClick,
}: {
  run: Chat
  onClick?: (e: any) => void
}) {
  const provider = (run.metadata?.llmConfig as any)?.provider || 'unknown'
  const model = (run.metadata?.llmConfig as any)?.model || 'unknown'
  const state = run.state || 'created'
  
  const label = `Agent Run ${run.context.agentRunId?.slice(0, 8)} · ${state} · ${provider} · ${model}`

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center p-0 m-0 bg-transparent border-0"
      style={{ lineHeight: 1 }}
    >
      <StatusChip state={state} />
    </button>
  )
}
