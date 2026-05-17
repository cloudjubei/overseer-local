import type { Chat, LLMConfig } from 'thefactory-tools'
import { AgentRunBullet as AgentRunBulletBase, type AgentRunBulletProps } from 'thefactory-ui/web'

export default function AgentRunBullet({
  run,
  onClick,
}: {
  run: Chat
  onClick?: AgentRunBulletProps['onClick']
}) {
  const llm = run.metadata?.llmConfig as LLMConfig | undefined
  return (
    <AgentRunBulletBase
      run={{
        agentRunId: run.context.agentRunId,
        state: run.state ?? 'created',
        provider: llm?.provider,
        model: llm?.model,
      }}
      onClick={onClick}
    />
  )
}
