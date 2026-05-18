import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgents, type RunChat } from '@core/contexts/AgentsContext'
import { useActiveProject } from '@core/contexts/ProjectsContext'
import { useStories } from '@core/contexts/StoriesContext'
import { getChatContextKey } from '@core/chats/chatKey'
import { AgentRunRowCard, ConfirmDialog, type AgentRunRowCardData } from 'thefactory-ui/web'

export default function AgentsView() {
  const { runs, runsActive, cancelRun, deleteRun, rateRun } = useAgents()
  const { projectId } = useActiveProject()
  const { getStory, getFeature } = useStories()
  const navigate = useNavigate()
  const [pendingDelete, setPendingDelete] = useState<RunChat | null>(null)

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full opacity-60">
        <p className="text-sm">No project selected.</p>
      </div>
    )
  }

  const projectRuns = runs.filter((r) => r.context.projectId === projectId)
  const projectActive = runsActive.filter((r) => r.context.projectId === projectId)
  const projectHistory = projectRuns.filter((r) => !projectActive.includes(r))

  const openRun = (run: RunChat) => {
    const key = getChatContextKey(run.context)
    navigate(`/projects/${projectId}/chat/${encodeURIComponent(key)}`)
  }

  const renderRow = (r: RunChat, opts: { active: boolean }) => {
    const storyTitle = r.context.storyId ? getStory(r.context.storyId)?.title : undefined
    const featureTitle =
      r.context.type === 'AGENT_RUN_FEATURE' && r.context.storyId && r.context.featureId
        ? getFeature(r.context.storyId, r.context.featureId)?.title
        : undefined
    const target = featureTitle
      ? `${storyTitle ?? '…'} / ${featureTitle}`
      : (storyTitle ?? r.context.storyId)
    const messageCount = r.messages?.length ?? 0
    const totalCostUSD = (r.messages ?? []).reduce((sum, m) => sum + (m.usage?.cost ?? 0), 0)
    const data: AgentRunRowCardData = {
      runId: r.context.agentRunId,
      state: toChipState(r.state),
      messageCount,
      totalCostUSD,
      ratingScore: r.rating?.score ?? 0,
      type: r.context.type === 'AGENT_RUN_FEATURE' ? 'feature' : 'story',
    }
    return (
      <AgentRunRowCard
        key={getChatContextKey(r.context)}
        target={target}
        run={data}
        onOpen={() => openRun(r)}
        onCancel={opts.active ? () => void cancelRun(r) : undefined}
        onDelete={!opts.active ? () => setPendingDelete(r) : undefined}
        onRate={!opts.active ? (score) => void rateRun(r, score) : undefined}
      />
    )
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden">
      <header
        className="flex items-baseline justify-between gap-3 px-4 sm:px-8 py-5 border-b flex-wrap"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <h1 className="text-2xl font-semibold">Agents</h1>
        <span className="text-xs opacity-60">
          {projectActive.length} running · {projectHistory.length} finished
        </span>
      </header>

      <div className="flex-1 overflow-auto px-4 sm:px-8 py-6 flex flex-col gap-6">
        <Section title="Active" empty="No active runs.">
          {projectActive.map((r) => renderRow(r, { active: true }))}
        </Section>
        <Section title="History" empty="No completed runs yet.">
          {projectHistory.map((r) => renderRow(r, { active: false }))}
        </Section>
      </div>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await deleteRun(pendingDelete)
        }}
        title="Delete agent run?"
        description="This removes the run's chat and message history. The work it produced (commits, files) is unaffected."
        confirmLabel="Delete"
        destructive
      />
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const hasChildren = Array.isArray(children) && children.filter(Boolean).length > 0
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wide opacity-60">{title}</h2>
      {hasChildren ? (
        <div className="flex flex-col gap-1.5">{children}</div>
      ) : (
        <p className="text-sm opacity-60">{empty}</p>
      )}
    </section>
  )
}

// Maps the runtime run state string to the library's `ChipState` union.
// Anything not matching is treated as `completed`.
function toChipState(state: string | undefined): AgentRunRowCardData['state'] {
  switch (state) {
    case 'running':
    case 'cancelled':
    case 'error':
    case 'created':
      return state
    default:
      return 'completed'
  }
}
