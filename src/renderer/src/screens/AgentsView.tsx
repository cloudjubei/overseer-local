import { useEffect, useMemo, useState } from 'react'
import { useAgents } from '../contexts/AgentsContext'
import ChatConversation from '../components/agents/ChatConversation'
import AgentRunRow from '../components/agents/AgentRunRow'
import ModelChip from '../components/agents/ModelChip'
import ProjectChip from '../components/agents/ProjectChip'
import { useActiveProject } from '../contexts/ProjectContext'
import { ChatSidebarPanel } from '../components/chat'
import { ChatContext } from 'thefactory-tools'
import { useAppSettings } from '../contexts/AppSettingsContext'

function formatTime(iso?: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString()
  } catch {
    return iso ?? ''
  }
}

function formatUSD(n?: number) {
  if (n == null || !isFinite(n)) return '\u2014'
  return `$${n.toFixed(4)}`
}

function formatInteger(n?: number) {
  if (n == null || !isFinite(n)) return '\u2014'
  return Math.round(n).toLocaleString()
}

function formatDuration(ms?: number) {
  if (ms == null || !isFinite(ms) || ms < 0) return '\u2014'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = Math.floor(ms / 1000)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const parts: string[] = []
  if (hrs) parts.push(`${hrs}h`)
  if (mins) parts.push(`${mins}m`)
  parts.push(`${secs}s`)
  return parts.join(' ')
}

const CurrentProjectView = () => {
  const { runsHistory, cancelRun, deleteRunHistory, rateRun } = useAgents()
  const { projectId } = useActiveProject()
  const [openRunId, setOpenRunId] = useState<string | null>(null)

  const projectKpis = useMemo(() => {
    const projectRuns = runsHistory.filter((r) => r.projectId === projectId)

    const runCalcs = projectRuns.map((r) => {
      const conversations = r.conversations ?? []
      const messages = conversations.flatMap((c) => c.messages ?? [])
      const prompt = messages.map((m) => m.promptTokens ?? 0).reduce((a, b) => a + b, 0)
      const completion = messages.map((m) => m.completionTokens ?? 0).reduce((a, b) => a + b, 0)
      const inputPerM = r.price?.inputPerMTokensUSD ?? 0
      const outputPerM = r.price?.outputPerMTokensUSD ?? 0
      const costUSD = (inputPerM * prompt) / 1_000_000 + (outputPerM * completion) / 1_000_000
      const startedMs = r.startedAt ? new Date(r.startedAt).getTime() : NaN
      const finishedMs = r.finishedAt
        ? new Date(r.finishedAt).getTime()
        : r.updatedAt
          ? new Date(r.updatedAt).getTime()
          : Date.now()
      const durationMs =
        isFinite(startedMs) && isFinite(finishedMs) ? Math.max(0, finishedMs - startedMs) : 0
      const totalFeatures = conversations.length
      return { costUSD, durationMs, totalFeatures }
    })

    const totalRuns = runCalcs.length
    const totalCost = runCalcs.reduce((a, b) => a + (b.costUSD || 0), 0)
    const totalDurationMs = runCalcs.reduce((a, b) => a + (b.durationMs || 0), 0)
    const featuresTotal = runCalcs.reduce((a, b) => a + (b.totalFeatures || 0), 0)

    return { totalRuns, cost: totalCost, totalDurationMs, featuresTotal }
  }, [runsHistory, projectId])

  const activeProjectRuns = useMemo(
    () =>
      runsHistory
        .filter(
          (r) => r.projectId === projectId && (r.state === 'created' || r.state === 'running'),
        )
        .slice()
        .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')),
    [runsHistory, projectId],
  )

  const projectRuns = useMemo(
    () =>
      runsHistory
        .filter(
          (r) => r.projectId === projectId && !(r.state === 'created' || r.state === 'running'),
        )
        .slice()
        .sort((a, b) =>
          (b.finishedAt || b.updatedAt || '').localeCompare(a.finishedAt || a.updatedAt || ''),
        ),
    [runsHistory, projectId],
  )

  useEffect(() => {
    const hash = (window.location.hash || '').replace(/^#/, '')
    const m = /^agents\/run\/(.+)$/.exec(hash)
    if (m && m[1]) {
      const id = m[1]
      setTimeout(() => {
        const el = document.getElementById(`run-${id}`)
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
          el.classList.add('highlighted')
          setTimeout(() => el.classList.remove('highlighted'), 2000)
        }
      }, 0)
    }
  }, [projectRuns.length])

  const selectedRun = useMemo(() => {
    if (!openRunId) return undefined
    return (
      projectRuns.find((r) => r.id === openRunId) ||
      activeProjectRuns.find((r) => r.id === openRunId)
    )
  }, [openRunId, projectRuns, activeProjectRuns])

  return (
    <>
      <div className="p-4 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Total Runs</div>
            <div className="text-lg font-semibold">{projectKpis.totalRuns}</div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Total Time Spent</div>
            <div className="text-lg font-semibold">
              {formatDuration(projectKpis.totalDurationMs)}
            </div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Total Cost</div>
            <div className="text-lg font-semibold">{formatUSD(projectKpis.cost)}</div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Total Features Worked On</div>
            <div className="text-lg font-semibold">{formatInteger(projectKpis.featuresTotal)}</div>
          </div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Active ({activeProjectRuns.length})
            </h2>
          </div>
          {activeProjectRuns.length === 0 ? (
            <div className="text-sm text-neutral-500">No active agents.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Story</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">Features</th>
                    <th className="text-left px-3 py-2">Cost</th>
                    <th className="text-left px-3 py-2">Tokens</th>
                    <th className="text-left px-3 py-2">Thinking</th>
                    <th className="text-left px-3 py-2">Duration</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProjectRuns.map((r) => (
                    <AgentRunRow
                      key={r.id}
                      run={r}
                      onView={(id) => setOpenRunId(id)}
                      onCancel={(id) => cancelRun(id)}
                      showModel
                      showStatus={false}
                      showFeaturesInsteadOfTurn={true}
                      showThinking={true}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              History ({projectRuns.length})
            </h2>
          </div>
          {projectRuns.length === 0 ? (
            <div className="text-sm text-neutral-500">No runs yet for this project.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Story</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">Features</th>
                    <th className="text-left px-3 py-2">Cost</th>
                    <th className="text-left px-3 py-2">Tokens</th>
                    <th className="text-left px-3 py-2">Duration</th>
                    <th className="text-left px-3 py-2">Rating</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRuns.map((r) => (
                    <AgentRunRow
                      key={r.id}
                      run={r}
                      onView={(id) => setOpenRunId(id)}
                      onCancel={(id) => cancelRun(id)}
                      onDelete={(id) => deleteRunHistory(id)}
                      onRate={(id, rating) => rateRun(id, rating)}
                      showModel
                      showStatus={true}
                      showFeaturesInsteadOfTurn={true}
                      showThinking={false}
                      showRating={true}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedRun ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpenRunId(null)} />
          <div className="relative bg-white dark:bg-neutral-950 rounded-lg shadow-xl w-[92vw] max-w-5xl max-h-[90vh] border border-neutral-200 dark:border-neutral-800">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">
                  Run #{selectedRun.id.slice(0, 8)} {selectedRun.storyId ?? 'Story'}
                </div>
                <div className="text-xs text-neutral-500 truncate flex items-center gap-2">
                  <ModelChip
                    provider={selectedRun.llmConfig.provider}
                    model={selectedRun.llmConfig.model}
                  />
                  <span>
                    {selectedRun.state} Updated {formatTime(selectedRun.updatedAt)}
                  </span>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setOpenRunId(null)}>
                Close
              </button>
            </div>
            <ChatConversation run={selectedRun} />
          </div>
        </div>
      ) : null}
    </>
  )
}

const AllProjectsView = () => {
  const { runsHistory } = useAgents()

  type ModelKey = string // provider::model
  type ProjectKey = string // projectId
  type AgentTypeKey = string // agentType

  const stats = useMemo(() => {
    const allRuns = runsHistory.slice()

    const runCalcs = allRuns.map((r) => {
      const conversations = r.conversations ?? []
      const messages = conversations.flatMap((c) => c.messages ?? [])
      const prompt = messages.map((m) => m.promptTokens ?? 0).reduce((a, b) => a + b, 0)
      const completion = messages.map((m) => m.completionTokens ?? 0).reduce((a, b) => a + b, 0)
      const inputPerM = r.price?.inputPerMTokensUSD ?? 0
      const outputPerM = r.price?.outputPerMTokensUSD ?? 0
      const costUSD = (inputPerM * prompt) / 1_000_000 + (outputPerM * completion) / 1_000_000
      const startedMs = r.startedAt ? new Date(r.startedAt).getTime() : NaN
      const finishedMs = r.finishedAt
        ? new Date(r.finishedAt).getTime()
        : r.updatedAt
          ? new Date(r.updatedAt).getTime()
          : Date.now()
      const durationMs =
        isFinite(startedMs) && isFinite(finishedMs)
          ? Math.max(0, finishedMs - startedMs)
          : undefined
      const completedFeatures = conversations.filter((c) => c.state === 'completed').length
      const totalFeatures = conversations.length
      const modelKey: ModelKey = `${r.llmConfig?.provider || 'unknown'}::${r.llmConfig?.model || 'unknown'}`
      const projectKey: ProjectKey = r.projectId || 'unknown'
      const agentTypeKey: AgentTypeKey = (r.agentType as string) || 'unknown'
      const rating = r.rating?.score // 0 or 1
      return {
        r,
        prompt,
        completion,
        costUSD,
        durationMs,
        completedFeatures,
        totalFeatures,
        modelKey,
        projectKey,
        agentTypeKey,
        rating,
      }
    })

    // Overall totals
    const totalRuns = runCalcs.length
    const totalPrompt = runCalcs.reduce((a, b) => a + (b.prompt || 0), 0)
    const totalCompletion = runCalcs.reduce((a, b) => a + (b.completion || 0), 0)
    const totalCost = runCalcs.reduce((a, b) => a + (b.costUSD || 0), 0)
    const totalDurationMs = runCalcs.reduce((a, b) => a + (b.durationMs || 0), 0)
    const totalFeaturesSum = runCalcs.reduce((a, b) => a + (b.totalFeatures || 0), 0)

    // Group by model
    const byModel = new Map<ModelKey, ReturnType<typeof makeModelAgg>>()
    function makeModelAgg() {
      return {
        runs: 0,
        costSum: 0,
        tokensSum: 0,
        durationSumMs: 0, // total duration across runs (for reference)
        completedFeaturesSum: 0,
        ratingSum: 0,
        ratingCount: 0,
        any: null as null | (typeof runCalcs)[number],
      }
    }
    for (const rc of runCalcs) {
      const m = byModel.get(rc.modelKey) || makeModelAgg()
      m.runs += 1
      m.costSum += rc.costUSD || 0
      m.tokensSum += (rc.prompt || 0) + (rc.completion || 0)
      if (rc.durationMs != null) m.durationSumMs += rc.durationMs
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        // For per-feature average, aggregate as total duration over total completed features
        m.completedFeaturesSum += rc.completedFeatures
      }
      if (rc.rating != null) {
        m.ratingSum += rc.rating
        m.ratingCount += 1
      }
      if (!m.any) m.any = rc
      byModel.set(rc.modelKey, m)
    }

    const modelsList = Array.from(byModel.entries()).map(([key, m]) => {
      const [provider, model] = key.split('::')
      const avgCost = m.runs ? m.costSum / m.runs : undefined
      const avgTokens = m.runs ? m.tokensSum / m.runs : undefined
      const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined
      const avgPerFeatureDurationMs =
        m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined
      return {
        key,
        provider,
        model,
        runs: m.runs,
        totalCost: m.costSum,
        avgCost,
        avgTokens,
        avgRating,
        avgPerFeatureDurationMs,
      }
    })

    // Extremes overall (consider only defined metrics)
    const cheapestModel = modelsList
      .filter((m) => m.avgCost != null)
      .sort((a, b) => a.avgCost! - b.avgCost!)[0]
    const mostExpensiveModel = modelsList
      .filter((m) => m.avgCost != null)
      .sort((a, b) => b.avgCost! - a.avgCost!)[0]
    const fastestModel = modelsList
      .filter((m) => m.avgPerFeatureDurationMs != null)
      .sort((a, b) => a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!)[0]
    const slowestModel = modelsList
      .filter((m) => m.avgPerFeatureDurationMs != null)
      .sort((a, b) => b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!)[0]
    const highestRatedModel = modelsList
      .filter((m) => m.avgRating != null)
      .sort((a, b) => b.avgRating! - a.avgRating!)[0]
    const lowestRatedModel = modelsList
      .filter((m) => m.avgRating != null)
      .sort((a, b) => a.avgRating! - b.avgRating!)[0]

    // Group by project, with per-model extremes within each project
    type ProjectAgg = {
      key: ProjectKey
      runs: number
      costSum: number
      byModel: Map<ModelKey, ReturnType<typeof makeModelAgg>>
    }
    const byProject = new Map<ProjectKey, ProjectAgg>()
    for (const rc of runCalcs) {
      const p = byProject.get(rc.projectKey) || {
        key: rc.projectKey,
        runs: 0,
        costSum: 0,
        byModel: new Map(),
      }
      p.runs += 1
      p.costSum += rc.costUSD || 0
      const pm = p.byModel.get(rc.modelKey) || makeModelAgg()
      pm.runs += 1
      pm.costSum += rc.costUSD || 0
      pm.tokensSum += (rc.prompt || 0) + (rc.completion || 0)
      if (rc.durationMs != null) pm.durationSumMs += rc.durationMs
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        pm.completedFeaturesSum += rc.completedFeatures
      }
      if (rc.rating != null) {
        pm.ratingSum += rc.rating
        pm.ratingCount += 1
      }
      if (!pm.any) pm.any = rc
      p.byModel.set(rc.modelKey, pm)
      byProject.set(rc.projectKey, p)
    }

    const projectsList = Array.from(byProject.values())
      .map((p) => {
        const models = Array.from(p.byModel.entries()).map(([key, m]) => {
          const [provider, model] = key.split('::')
          const avgCost = m.runs ? m.costSum / m.runs : undefined
          const avgTokens = m.runs ? m.tokensSum / m.runs : undefined
          const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined
          const avgPerFeatureDurationMs =
            m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined
          return {
            key,
            provider,
            model,
            runs: m.runs,
            avgCost,
            avgTokens,
            avgRating,
            avgPerFeatureDurationMs,
          }
        })
        const cheapest = models
          .filter((m) => m.avgCost != null)
          .sort((a, b) => a.avgCost! - b.avgCost!)[0]
        const mostExpensive = models
          .filter((m) => m.avgCost != null)
          .sort((a, b) => b.avgCost! - a.avgCost!)[0]
        const fastest = models
          .filter((m) => m.avgPerFeatureDurationMs != null)
          .sort((a, b) => a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!)[0]
        const slowest = models
          .filter((m) => m.avgPerFeatureDurationMs != null)
          .sort((a, b) => b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!)[0]
        const highestRated = models
          .filter((m) => m.avgRating != null)
          .sort((a, b) => b.avgRating! - a.avgRating!)[0]
        const lowestRated = models
          .filter((m) => m.avgRating != null)
          .sort((a, b) => a.avgRating! - b.avgRating!)[0]

        return {
          projectId: p.key,
          runs: p.runs,
          costSum: p.costSum,
          avgCost: p.runs ? p.costSum / p.runs : undefined,
          models,
          cheapest,
          mostExpensive,
          fastest,
          slowest,
          highestRated,
          lowestRated,
        }
      })
      .sort((a, b) => a.projectId.localeCompare(b.projectId))

    // Group by agent type (Agents statistics section)
    type AgentAgg = {
      key: AgentTypeKey
      runs: number
      costSum: number
      byModel: Map<ModelKey, ReturnType<typeof makeModelAgg>>
    }
    const byAgentType = new Map<AgentTypeKey, AgentAgg>()
    for (const rc of runCalcs) {
      const a = byAgentType.get(rc.agentTypeKey) || {
        key: rc.agentTypeKey,
        runs: 0,
        costSum: 0,
        byModel: new Map(),
      }
      a.runs += 1
      a.costSum += rc.costUSD || 0
      const am = a.byModel.get(rc.modelKey) || makeModelAgg()
      am.runs += 1
      am.costSum += rc.costUSD || 0
      am.tokensSum += (rc.prompt || 0) + (rc.completion || 0)
      if (rc.durationMs != null) am.durationSumMs += rc.durationMs
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        am.completedFeaturesSum += rc.completedFeatures
      }
      if (rc.rating != null) {
        am.ratingSum += rc.rating
        am.ratingCount += 1
      }
      if (!am.any) am.any = rc
      a.byModel.set(rc.modelKey, am)
      byAgentType.set(rc.agentTypeKey, a)
    }

    const agentsList = Array.from(byAgentType.values())
      .map((a) => {
        const models = Array.from(a.byModel.entries()).map(([key, m]) => {
          const [provider, model] = key.split('::')
          const avgCost = m.runs ? m.costSum / m.runs : undefined
          const avgTokens = m.runs ? m.tokensSum / m.runs : undefined
          const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined
          const avgPerFeatureDurationMs =
            m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined
          return {
            key,
            provider,
            model,
            runs: m.runs,
            avgCost,
            avgTokens,
            avgRating,
            avgPerFeatureDurationMs,
          }
        })
        const cheapest = models
          .filter((m) => m.avgCost != null)
          .sort((a, b) => a.avgCost! - b.avgCost!)[0]
        const mostExpensive = models
          .filter((m) => m.avgCost != null)
          .sort((a, b) => b.avgCost! - a.avgCost!)[0]
        const fastest = models
          .filter((m) => m.avgPerFeatureDurationMs != null)
          .sort((a, b) => a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!)[0]
        const slowest = models
          .filter((m) => m.avgPerFeatureDurationMs != null)
          .sort((a, b) => b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!)[0]
        const highestRated = models
          .filter((m) => m.avgRating != null)
          .sort((a, b) => b.avgRating! - a.avgRating!)[0]
        const lowestRated = models
          .filter((m) => m.avgRating != null)
          .sort((a, b) => a.avgRating! - b.avgRating!)[0]

        return {
          agentType: a.key,
          runs: a.runs,
          costSum: a.costSum,
          avgCost: a.runs ? a.costSum / a.runs : undefined,
          models,
          cheapest,
          mostExpensive,
          fastest,
          slowest,
          highestRated,
          lowestRated,
        }
      })
      .sort((a, b) => a.agentType.localeCompare(b.agentType))

    return {
      kpis: {
        totalRuns,
        totals: { prompt: totalPrompt, completion: totalCompletion },
        cost: totalCost,
        totalDurationMs,
        featuresTotal: totalFeaturesSum,
      },
      modelsList,
      extremes: {
        cheapestModel,
        mostExpensiveModel,
        fastestModel,
        slowestModel,
        highestRatedModel,
        lowestRatedModel,
      },
      projectsList,
      agentsList,
    }
  }, [runsHistory])

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Runs</div>
          <div className="text-lg font-semibold">{stats.kpis.totalRuns}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Time Spent</div>
          <div className="text-lg font-semibold">{formatDuration(stats.kpis.totalDurationMs)}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Cost</div>
          <div className="text-lg font-semibold">{formatUSD(stats.kpis.cost)}</div>
        </div>
        <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500">Total Features Worked On</div>
          <div className="text-lg font-semibold">{formatInteger(stats.kpis.featuresTotal)}</div>
        </div>
      </div>

      {/* Project Statistics (moved above models), with Overall row */}
      <div>
        <h3 className="text-base font-semibold mb-2">Project Statistics</h3>
        {stats.projectsList.length === 0 ? (
          <div className="text-sm text-neutral-500">No runs yet.</div>
        ) : (
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Project</th>
                  <th className="text-left px-3 py-2">Runs</th>
                  <th className="text-left px-3 py-2">Total Cost</th>
                  <th className="text-left px-3 py-2">Avg Cost/Run</th>
                  <th className="text-left px-3 py-2">Cheapest Model</th>
                  <th className="text-left px-3 py-2">Most Expensive</th>
                  <th className="text-left px-3 py-2">
                    <div className="leading-tight">
                      <div>Fastest</div>
                      <div className="text-[10px] text-neutral-500">(per feature)</div>
                    </div>
                  </th>
                  <th className="text-left px-3 py-2">
                    <div className="leading-tight">
                      <div>Slowest</div>
                      <div className="text-[10px] text-neutral-500">(per feature)</div>
                    </div>
                  </th>
                  <th className="text-left px-3 py-2">Highest Rated</th>
                  <th className="text-left px-3 py-2">Lowest Rated</th>
                </tr>
              </thead>
              <tbody>
                {/* Overall row */}
                <tr className="border-t border-neutral-200 dark:border-neutral-800 bg-blue-50/70 dark:bg-blue-900/20">
                  <td className="px-3 py-2 font-medium">Overall</td>
                  <td className="px-3 py-2">{formatInteger(stats.kpis.totalRuns)}</td>
                  <td className="px-3 py-2">{formatUSD(stats.kpis.cost)}</td>
                  <td className="px-3 py-2">
                    {formatUSD(
                      stats.kpis.totalRuns ? stats.kpis.cost / stats.kpis.totalRuns : undefined,
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.cheapestModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.cheapestModel.provider}
                          model={stats.extremes.cheapestModel.model}
                        />
                        <span className="text-neutral-500 text-xs">
                          {formatUSD(stats.extremes.cheapestModel.avgCost)}
                        </span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.mostExpensiveModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.mostExpensiveModel.provider}
                          model={stats.extremes.mostExpensiveModel.model}
                        />
                        <span className="text-neutral-500 text-xs">
                          {formatUSD(stats.extremes.mostExpensiveModel.avgCost)}
                        </span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.fastestModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.fastestModel.provider}
                          model={stats.extremes.fastestModel.model}
                        />
                        <span className="text-neutral-500 text-xs">
                          {formatDuration(stats.extremes.fastestModel.avgPerFeatureDurationMs)}
                        </span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.slowestModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.slowestModel.provider}
                          model={stats.extremes.slowestModel.model}
                        />
                        <span className="text-neutral-500 text-xs">
                          {formatDuration(stats.extremes.slowestModel.avgPerFeatureDurationMs)}
                        </span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.highestRatedModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.highestRatedModel.provider}
                          model={stats.extremes.highestRatedModel.model}
                        />
                        <span className="text-neutral-500 text-xs">{`${(stats.extremes.highestRatedModel.avgRating! * 100).toFixed(0)}%`}</span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {stats.extremes.lowestRatedModel ? (
                      <div className="flex flex-col items-start gap-1">
                        <ModelChip
                          provider={stats.extremes.lowestRatedModel.provider}
                          model={stats.extremes.lowestRatedModel.model}
                        />
                        <span className="text-neutral-500 text-xs">{`${(stats.extremes.lowestRatedModel.avgRating! * 100).toFixed(0)}%`}</span>
                      </div>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                </tr>

                {stats.projectsList.map((p) => (
                  <tr
                    key={p.projectId}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="px-3 py-2">
                      <ProjectChip projectId={p.projectId} />
                    </td>
                    <td className="px-3 py-2">{formatInteger(p.runs)}</td>
                    <td className="px-3 py-2">{formatUSD(p.costSum)}</td>
                    <td className="px-3 py-2">{formatUSD(p.avgCost)}</td>
                    <td className="px-3 py-2">
                      {p.cheapest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={p.cheapest.provider} model={p.cheapest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatUSD(p.cheapest.avgCost)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.mostExpensive ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={p.mostExpensive.provider}
                            model={p.mostExpensive.model}
                          />
                          <span className="text-neutral-500 text-xs">
                            {formatUSD(p.mostExpensive.avgCost)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.fastest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={p.fastest.provider} model={p.fastest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatDuration(p.fastest.avgPerFeatureDurationMs)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.slowest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={p.slowest.provider} model={p.slowest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatDuration(p.slowest.avgPerFeatureDurationMs)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.highestRated ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={p.highestRated.provider}
                            model={p.highestRated.model}
                          />
                          <span className="text-neutral-500 text-xs">{`${(p.highestRated.avgRating! * 100).toFixed(0)}%`}</span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {p.lowestRated ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={p.lowestRated.provider}
                            model={p.lowestRated.model}
                          />
                          <span className="text-neutral-500 text-xs">{`${(p.lowestRated.avgRating! * 100).toFixed(0)}%`}</span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agents Statistics */}
      <div>
        <h3 className="text-base font-semibold mb-2">Agents Statistics</h3>
        {stats.agentsList.length === 0 ? (
          <div className="text-sm text-neutral-500">No runs yet.</div>
        ) : (
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Agent Type</th>
                  <th className="text-left px-3 py-2">Runs</th>
                  <th className="text-left px-3 py-2">Total Cost</th>
                  <th className="text-left px-3 py-2">Avg Cost/Run</th>
                  <th className="text-left px-3 py-2">Cheapest Model</th>
                  <th className="text-left px-3 py-2">Most Expensive</th>
                  <th className="text-left px-3 py-2">
                    <div className="leading-tight">
                      <div>Fastest</div>
                      <div className="text-[10px] text-neutral-500">(per feature)</div>
                    </div>
                  </th>
                  <th className="text-left px-3 py-2">
                    <div className="leading-tight">
                      <div>Slowest</div>
                      <div className="text-[10px] text-neutral-500">(per feature)</div>
                    </div>
                  </th>
                  <th className="text-left px-3 py-2">Highest Rated</th>
                  <th className="text-left px-3 py-2">Lowest Rated</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentsList.map((a) => (
                  <tr
                    key={a.agentType}
                    className="border-t border-neutral-200 dark:border-neutral-800"
                  >
                    <td className="px-3 py-2">{a.agentType}</td>
                    <td className="px-3 py-2">{formatInteger(a.runs)}</td>
                    <td className="px-3 py-2">{formatUSD(a.costSum)}</td>
                    <td className="px-3 py-2">{formatUSD(a.avgCost)}</td>
                    <td className="px-3 py-2">
                      {a.cheapest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={a.cheapest.provider} model={a.cheapest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatUSD(a.cheapest.avgCost)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.mostExpensive ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={a.mostExpensive.provider}
                            model={a.mostExpensive.model}
                          />
                          <span className="text-neutral-500 text-xs">
                            {formatUSD(a.mostExpensive.avgCost)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.fastest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={a.fastest.provider} model={a.fastest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatDuration(a.fastest.avgPerFeatureDurationMs)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.slowest ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip provider={a.slowest.provider} model={a.slowest.model} />
                          <span className="text-neutral-500 text-xs">
                            {formatDuration(a.slowest.avgPerFeatureDurationMs)}
                          </span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.highestRated ? (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={a.highestRated.provider}
                            model={a.highestRated.model}
                          />
                          <span className="text-neutral-500 text-xs">{`${(a.highestRated.avgRating! * 100).toFixed(0)}%`}</span>
                        </div>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {a.lowestRated && (
                        <div className="flex flex-col items-start gap-1">
                          <ModelChip
                            provider={a.lowestRated.provider}
                            model={a.lowestRated.model}
                          />
                          <span className="text-neutral-500 text-xs">{`${(a.lowestRated.avgRating! * 100).toFixed(0)}%`}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-Model stats table (moved below projects and updated columns) */}
      <div>
        <h3 className="text-base font-semibold mb-2">Model Statistics</h3>
        {stats.modelsList.length === 0 ? (
          <div className="text-sm text-neutral-500">No runs yet.</div>
        ) : (
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Model</th>
                  <th className="text-left px-3 py-2">Runs</th>
                  <th className="text-left px-3 py-2">Total Cost</th>
                  <th className="text-left px-3 py-2">Avg Cost/Run</th>
                  <th className="text-left px-3 py-2">Avg Tokens/Run</th>
                  <th className="text-left px-3 py-2">Avg Duration/Feature</th>
                  <th className="text-left px-3 py-2">Avg Rating</th>
                </tr>
              </thead>
              <tbody>
                {stats.modelsList
                  .sort((a, b) => (a.provider + a.model).localeCompare(b.provider + b.model))
                  .map((m) => (
                    <tr key={m.key} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2">
                        <ModelChip provider={m.provider} model={m.model} />
                      </td>
                      <td className="px-3 py-2">{formatInteger(m.runs)}</td>
                      <td className="px-3 py-2">{formatUSD(m.totalCost)}</td>
                      <td className="px-3 py-2">{formatUSD(m.avgCost)}</td>
                      <td className="px-3 py-2">{formatInteger(m.avgTokens)}</td>
                      <td className="px-3 py-2">{formatDuration(m.avgPerFeatureDurationMs)}</td>
                      <td className="px-3 py-2">
                        {m.avgRating != null ? `${(m.avgRating * 100).toFixed(0)}%` : '\u2014'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AgentsView() {
  const [viewMode, setViewMode] = useState<'current' | 'all'>('current')
  const { projectId } = useActiveProject()
  const { appSettings, setUserPreferences } = useAppSettings()

  const chatContext: ChatContext | undefined = useMemo(() => {
    if (!projectId) return undefined
    return { type: 'PROJECT_TOPIC', projectId, projectTopic: 'agent_runs' }
  }, [projectId])

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Agents</div>
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              {viewMode === 'current'
                ? 'Monitor running agents, usage and costs'
                : 'Summaries across all runs, costs, and model performance'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md p-1 bg-neutral-100 dark:bg-neutral-900">
              <button
                onClick={() => setViewMode('current')}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                  viewMode === 'current'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Current Project
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                  viewMode === 'all'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                All Projects
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {viewMode === 'current' ? <CurrentProjectView /> : <AllProjectsView />}
        </div>
      </div>
      {viewMode === 'current' && chatContext && (
        <ChatSidebarPanel
          context={chatContext}
          chatContextTitle="Agents chat"
          initialWidth={appSettings.userPreferences.chatSidebarWidth || 420}
          onWidthChange={(w, final) => {
            if (final) setUserPreferences({ chatSidebarWidth: Math.round(w) })
          }}
        />
      )}
    </div>
  )
}
