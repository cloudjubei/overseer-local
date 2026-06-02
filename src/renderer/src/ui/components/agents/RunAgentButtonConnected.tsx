import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents, type AgentType } from 'thefactory-ui/headless'
import { getChatContextKey } from '@core/chats/chatKey'
import { RunAgentButton as RunAgentButtonUI } from 'thefactory-ui/web'

type Props = {
  projectId: string
  storyId: string
  featureId?: string
  className?: string
}

/**
 * Thin app-side wrapper around `thefactory-ui`'s `RunAgentButton`. The
 * visual / interaction layer (long-press, picker, drag-protection, sticky
 * actions column) lives in the package; the wrapper here owns the
 * web-specific concerns: which agent context to start, where to navigate
 * the chat to, and the transient error display.
 */
export default function RunAgentButtonConnected({ projectId, storyId, featureId, className }: Props) {
  const { startAgent } = useAgents()
  const navigate = useNavigate()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!err) return
    const t = window.setTimeout(() => setErr(null), 4000)
    return () => window.clearTimeout(t)
  }, [err])

  const handle = async (agentType: AgentType) => {
    try {
      const { chatContext } = await startAgent({ agentType, projectId, storyId, featureId })
      const key = getChatContextKey(chatContext)
      navigate(`/projects/${projectId}/chat/${encodeURIComponent(key)}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={`relative inline-flex items-center gap-1 ${className ?? ''}`}>
      <RunAgentButtonUI onClick={(t) => void handle(t as AgentType)} />
      {err && <span className="text-xs text-red-500">{err}</span>}
    </div>
  )
}
