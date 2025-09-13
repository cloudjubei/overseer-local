import { useMemo } from 'react';
import { useAgents } from '../contexts/AgentsContext';
import ModelChip from '../components/agents/ModelChip';
import ProjectChip from '../components/agents/ProjectChip';

function formatUSD(n?: number) {
  if (n == null || !isFinite(n)) return '\u2014';
  return `$${n.toFixed(4)}`;
}

function formatInteger(n?: number) {
  if (n == null || !isFinite(n)) return '\u2014';
  return Math.round(n).toLocaleString();
}

function formatDuration(ms?: number) {
  if (ms == null || !isFinite(ms) || ms < 0) return '\u2014';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const parts: string[] = [];
  if (hrs) parts.push(`${hrs}h`);
  if (mins) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export default function AllAgentsView() {
  const { runsHistory } = useAgents();

  type ModelKey = string; // provider::model
  type ProjectKey = string; // projectId
  type AgentTypeKey = string; // agentType

  const stats = useMemo(() => {
    const allRuns = runsHistory.slice();

    const runCalcs = allRuns.map((r) => {
      const prompt = r.conversations.flatMap((c) => c.messages).map((m) => m.promptTokens ?? 0).reduce((a, b) => a + b, 0);
      const completion = r.conversations.flatMap((c) => c.messages).map((m) => m.completionTokens ?? 0).reduce((a, b) => a + b, 0);
      const costUSD = (r.price.inputPerMTokensUSD * prompt) / 1_000_000 + (r.price.outputPerMTokensUSD * completion) / 1_000_000;
      const startedMs = r.startedAt ? new Date(r.startedAt).getTime() : NaN;
      const finishedMs = r.finishedAt ? new Date(r.finishedAt).getTime() : (r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now());
      const durationMs = isFinite(startedMs) && isFinite(finishedMs) ? Math.max(0, finishedMs - startedMs) : undefined;
      const completedFeatures = r.conversations.filter((c) => c.state === 'completed').length;
      const totalFeatures = r.conversations.length;
      const modelKey: ModelKey = `${r.llmConfig.provider || 'unknown'}::${r.llmConfig.model || 'unknown'}`;
      const projectKey: ProjectKey = r.projectId || 'unknown';
      const agentTypeKey: AgentTypeKey = (r.agentType as string) || 'unknown';
      const rating = r.rating?.score; // 0 or 1
      return { r, prompt, completion, costUSD, durationMs, completedFeatures, totalFeatures, modelKey, projectKey, agentTypeKey, rating };
    });

    // Overall totals
    const totalRuns = runCalcs.length;
    const totalPrompt = runCalcs.reduce((a, b) => a + (b.prompt || 0), 0);
    const totalCompletion = runCalcs.reduce((a, b) => a + (b.completion || 0), 0);
    const totalCost = runCalcs.reduce((a, b) => a + (b.costUSD || 0), 0);
    const totalDurationMs = runCalcs.reduce((a, b) => a + (b.durationMs || 0), 0);

    // Group by model
    const byModel = new Map<ModelKey, ReturnType<typeof makeModelAgg>>();
    function makeModelAgg() {
      return {
        runs: 0,
        costSum: 0,
        tokensSum: 0,
        durationSumMs: 0, // total duration across runs (for reference)
        completedFeaturesSum: 0,
        ratingSum: 0,
        ratingCount: 0,
        any: null as null | (typeof runCalcs[number]),
      };
    }
    for (const rc of runCalcs) {
      const m = byModel.get(rc.modelKey) || makeModelAgg();
      m.runs += 1;
      m.costSum += rc.costUSD || 0;
      m.tokensSum += (rc.prompt || 0) + (rc.completion || 0);
      if (rc.durationMs != null) m.durationSumMs += rc.durationMs;
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        // For per-feature average, aggregate as total duration over total completed features
        m.completedFeaturesSum += rc.completedFeatures;
      }
      if (rc.rating != null) {
        m.ratingSum += rc.rating;
        m.ratingCount += 1;
      }
      if (!m.any) m.any = rc;
      byModel.set(rc.modelKey, m);
    }

    const modelsList = Array.from(byModel.entries()).map(([key, m]) => {
      const [provider, model] = key.split('::');
      const avgCost = m.runs ? m.costSum / m.runs : undefined;
      const avgTokens = m.runs ? m.tokensSum / m.runs : undefined;
      const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined;
      const avgPerFeatureDurationMs = m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined;
      return { key, provider, model, runs: m.runs, totalCost: m.costSum, avgCost, avgTokens, avgRating, avgPerFeatureDurationMs };
    });

    // Extremes overall (consider only defined metrics)
    const cheapestModel = modelsList.filter(m => m.avgCost != null).sort((a, b) => (a.avgCost! - b.avgCost!))[0];
    const mostExpensiveModel = modelsList.filter(m => m.avgCost != null).sort((a, b) => (b.avgCost! - a.avgCost!))[0];
    const fastestModel = modelsList.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!))[0];
    const slowestModel = modelsList.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!))[0];
    const highestRatedModel = modelsList.filter(m => m.avgRating != null).sort((a, b) => (b.avgRating! - a.avgRating!))[0];
    const lowestRatedModel = modelsList.filter(m => m.avgRating != null).sort((a, b) => (a.avgRating! - b.avgRating!))[0];

    // Group by project, with per-model extremes within each project
    type ProjectAgg = {
      key: ProjectKey;
      runs: number;
      costSum: number;
      byModel: Map<ModelKey, ReturnType<typeof makeModelAgg>>;
    };
    const byProject = new Map<ProjectKey, ProjectAgg>();
    for (const rc of runCalcs) {
      const p = byProject.get(rc.projectKey) || { key: rc.projectKey, runs: 0, costSum: 0, byModel: new Map() };
      p.runs += 1;
      p.costSum += rc.costUSD || 0;
      const pm = p.byModel.get(rc.modelKey) || makeModelAgg();
      pm.runs += 1;
      pm.costSum += rc.costUSD || 0;
      pm.tokensSum += (rc.prompt || 0) + (rc.completion || 0);
      if (rc.durationMs != null) pm.durationSumMs += rc.durationMs;
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        pm.completedFeaturesSum += rc.completedFeatures;
      }
      if (rc.rating != null) {
        pm.ratingSum += rc.rating;
        pm.ratingCount += 1;
      }
      if (!pm.any) pm.any = rc;
      p.byModel.set(rc.modelKey, pm);
      byProject.set(rc.projectKey, p);
    }

    const projectsList = Array.from(byProject.values()).map((p) => {
      const models = Array.from(p.byModel.entries()).map(([key, m]) => {
        const [provider, model] = key.split('::');
        const avgCost = m.runs ? m.costSum / m.runs : undefined;
        const avgTokens = m.runs ? m.tokensSum / m.runs : undefined;
        const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined;
        const avgPerFeatureDurationMs = m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined;
        return { key, provider, model, runs: m.runs, avgCost, avgTokens, avgRating, avgPerFeatureDurationMs };
      });
      const cheapest = models.filter(m => m.avgCost != null).sort((a, b) => (a.avgCost! - b.avgCost!))[0];
      const mostExpensive = models.filter(m => m.avgCost != null).sort((a, b) => (b.avgCost! - a.avgCost!))[0];
      const fastest = models.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!))[0];
      const slowest = models.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!))[0];
      const highestRated = models.filter(m => m.avgRating != null).sort((a, b) => (b.avgRating! - a.avgRating!))[0];
      const lowestRated = models.filter(m => m.avgRating != null).sort((a, b) => (a.avgRating! - b.avgRating!))[0];

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
      };
    }).sort((a, b) => a.projectId.localeCompare(b.projectId));

    // Group by agent type (Agents statistics section)
    type AgentAgg = {
      key: AgentTypeKey;
      runs: number;
      costSum: number;
      byModel: Map<ModelKey, ReturnType<typeof makeModelAgg>>;
    };
    const byAgentType = new Map<AgentTypeKey, AgentAgg>();
    for (const rc of runCalcs) {
      const a = byAgentType.get(rc.agentTypeKey) || { key: rc.agentTypeKey, runs: 0, costSum: 0, byModel: new Map() };
      a.runs += 1;
      a.costSum += rc.costUSD || 0;
      const am = a.byModel.get(rc.modelKey) || makeModelAgg();
      am.runs += 1;
      am.costSum += rc.costUSD || 0;
      am.tokensSum += (rc.prompt || 0) + (rc.completion || 0);
      if (rc.durationMs != null) am.durationSumMs += rc.durationMs;
      if (rc.completedFeatures > 0 && rc.durationMs != null) {
        am.completedFeaturesSum += rc.completedFeatures;
      }
      if (rc.rating != null) {
        am.ratingSum += rc.rating;
        am.ratingCount += 1;
      }
      if (!am.any) am.any = rc;
      a.byModel.set(rc.modelKey, am);
      byAgentType.set(rc.agentTypeKey, a);
    }

    const agentsList = Array.from(byAgentType.values()).map((a) => {
      const models = Array.from(a.byModel.entries()).map(([key, m]) => {
        const [provider, model] = key.split('::');
        const avgCost = m.runs ? m.costSum / m.runs : undefined;
        const avgTokens = m.runs ? m.tokensSum / m.runs : undefined;
        const avgRating = m.ratingCount ? m.ratingSum / m.ratingCount : undefined;
        const avgPerFeatureDurationMs = m.completedFeaturesSum > 0 ? m.durationSumMs / m.completedFeaturesSum : undefined;
        return { key, provider, model, runs: m.runs, avgCost, avgTokens, avgRating, avgPerFeatureDurationMs };
      });
      const cheapest = models.filter(m => m.avgCost != null).sort((a, b) => (a.avgCost! - b.avgCost!))[0];
      const mostExpensive = models.filter(m => m.avgCost != null).sort((a, b) => (b.avgCost! - a.avgCost!))[0];
      const fastest = models.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (a.avgPerFeatureDurationMs! - b.avgPerFeatureDurationMs!))[0];
      const slowest = models.filter(m => m.avgPerFeatureDurationMs != null).sort((a, b) => (b.avgPerFeatureDurationMs! - a.avgPerFeatureDurationMs!))[0];
      const highestRated = models.filter(m => m.avgRating != null).sort((a, b) => (b.avgRating! - a.avgRating!))[0];
      const lowestRated = models.filter(m => m.avgRating != null).sort((a, b) => (a.avgRating! - b.avgRating!))[0];

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
      };
    }).sort((a, b) => a.agentType.localeCompare(b.agentType));

    return {
      kpis: {
        totalRuns,
        totals: { prompt: totalPrompt, completion: totalCompletion },
        cost: totalCost,
        totalDurationMs,
      },
      modelsList,
      extremes: { cheapestModel, mostExpensiveModel, fastestModel, slowestModel, highestRatedModel, lowestRatedModel },
      projectsList,
      agentsList,
    };
  }, [runsHistory]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">All Agents</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">Summaries across all runs, costs, and model performance</div>
      </div>

      <div className="p-4 space-y-6">
        {/* KPIs */}
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
            <div className="text-xs text-neutral-500">Avg Cost/Run</div>
            <div className="text-lg font-semibold">{formatUSD(stats.kpis.totalRuns ? stats.kpis.cost / stats.kpis.totalRuns : 0)}</div>
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
                    <th className="text-left px-3 py-2">Fastest (per-feature)</th>
                    <th className="text-left px-3 py-2">Slowest (per-feature)</th>
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
                    <td className="px-3 py-2">{formatUSD(stats.kpis.totalRuns ? stats.kpis.cost / stats.kpis.totalRuns : undefined)}</td>
                    <td className="px-3 py-2">{stats.extremes.cheapestModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.cheapestModel.provider} model={stats.extremes.cheapestModel.model} /> <span className="text-neutral-500">{formatUSD(stats.extremes.cheapestModel.avgCost)}</span></span>) : '—'}</td>
                    <td className="px-3 py-2">{stats.extremes.mostExpensiveModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.mostExpensiveModel.provider} model={stats.extremes.mostExpensiveModel.model} /> <span className="text-neutral-500">{formatUSD(stats.extremes.mostExpensiveModel.avgCost)}</span></span>) : '—'}</td>
                    <td className="px-3 py-2">{stats.extremes.fastestModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.fastestModel.provider} model={stats.extremes.fastestModel.model} /> <span className="text-neutral-500">{formatDuration(stats.extremes.fastestModel.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                    <td className="px-3 py-2">{stats.extremes.slowestModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.slowestModel.provider} model={stats.extremes.slowestModel.model} /> <span className="text-neutral-500">{formatDuration(stats.extremes.slowestModel.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                    <td className="px-3 py-2">{stats.extremes.highestRatedModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.highestRatedModel.provider} model={stats.extremes.highestRatedModel.model} /> <span className="text-neutral-500">{`${(stats.extremes.highestRatedModel.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
                    <td className="px-3 py-2">{stats.extremes.lowestRatedModel ? (<span className="inline-flex items-center gap-2"><ModelChip provider={stats.extremes.lowestRatedModel.provider} model={stats.extremes.lowestRatedModel.model} /> <span className="text-neutral-500">{`${(stats.extremes.lowestRatedModel.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
                  </tr>

                  {stats.projectsList.map((p) => (
                    <tr key={p.projectId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2"><ProjectChip projectId={p.projectId} /></td>
                      <td className="px-3 py-2">{formatInteger(p.runs)}</td>
                      <td className="px-3 py-2">{formatUSD(p.costSum)}</td>
                      <td className="px-3 py-2">{formatUSD(p.avgCost)}</td>
                      <td className="px-3 py-2">{p.cheapest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.cheapest.provider} model={p.cheapest.model} /> <span className="text-neutral-500">{formatUSD(p.cheapest.avgCost)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{p.mostExpensive ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.mostExpensive.provider} model={p.mostExpensive.model} /> <span className="text-neutral-500">{formatUSD(p.mostExpensive.avgCost)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{p.fastest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.fastest.provider} model={p.fastest.model} /> <span className="text-neutral-500">{formatDuration(p.fastest.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{p.slowest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.slowest.provider} model={p.slowest.model} /> <span className="text-neutral-500">{formatDuration(p.slowest.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{p.highestRated ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.highestRated.provider} model={p.highestRated.model} /> <span className="text-neutral-500">{`${(p.highestRated.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{p.lowestRated ? (<span className="inline-flex items-center gap-2"><ModelChip provider={p.lowestRated.provider} model={p.lowestRated.model} /> <span className="text-neutral-500">{`${(p.lowestRated.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
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
                    <th className="text-left px-3 py-2">Fastest (per-feature)</th>
                    <th className="text-left px-3 py-2">Slowest (per-feature)</th>
                    <th className="text-left px-3 py-2">Highest Rated</th>
                    <th className="text-left px-3 py-2">Lowest Rated</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.agentsList.map((a) => (
                    <tr key={a.agentType} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2">{a.agentType}</td>
                      <td className="px-3 py-2">{formatInteger(a.runs)}</td>
                      <td className="px-3 py-2">{formatUSD(a.costSum)}</td>
                      <td className="px-3 py-2">{formatUSD(a.avgCost)}</td>
                      <td className="px-3 py-2">{a.cheapest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.cheapest.provider} model={a.cheapest.model} /> <span className="text-neutral-500">{formatUSD(a.cheapest.avgCost)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{a.mostExpensive ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.mostExpensive.provider} model={a.mostExpensive.model} /> <span className="text-neutral-500">{formatUSD(a.mostExpensive.avgCost)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{a.fastest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.fastest.provider} model={a.fastest.model} /> <span className="text-neutral-500">{formatDuration(a.fastest.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{a.slowest ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.slowest.provider} model={a.slowest.model} /> <span className="text-neutral-500">{formatDuration(a.slowest.avgPerFeatureDurationMs)}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{a.highestRated ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.highestRated.provider} model={a.highestRated.model} /> <span className="text-neutral-500">{`${(a.highestRated.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
                      <td className="px-3 py-2">{a.lowestRated ? (<span className="inline-flex items-center gap-2"><ModelChip provider={a.lowestRated.provider} model={a.lowestRated.model} /> <span className="text-neutral-500">{`${(a.lowestRated.avgRating! * 100).toFixed(0)}%`}</span></span>) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Overall extremes */}
        <div>
          <h3 className="text-base font-semibold mb-2">Overall Model Highlights</h3>
          <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <tr>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Model</th>
                  <th className="text-left px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Cheapest (avg cost)</td>
                  <td className="px-3 py-2">{stats.extremes.cheapestModel ? (<ModelChip provider={stats.extremes.cheapestModel.provider} model={stats.extremes.cheapestModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.cheapestModel ? formatUSD(stats.extremes.cheapestModel.avgCost) : '—'}</td>
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Most Expensive (avg cost)</td>
                  <td className="px-3 py-2">{stats.extremes.mostExpensiveModel ? (<ModelChip provider={stats.extremes.mostExpensiveModel.provider} model={stats.extremes.mostExpensiveModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.mostExpensiveModel ? formatUSD(stats.extremes.mostExpensiveModel.avgCost) : '—'}</td>
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Fastest (avg per-feature)</td>
                  <td className="px-3 py-2">{stats.extremes.fastestModel ? (<ModelChip provider={stats.extremes.fastestModel.provider} model={stats.extremes.fastestModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.fastestModel ? formatDuration(stats.extremes.fastestModel.avgPerFeatureDurationMs) : '—'}</td>
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Slowest (avg per-feature)</td>
                  <td className="px-3 py-2">{stats.extremes.slowestModel ? (<ModelChip provider={stats.extremes.slowestModel.provider} model={stats.extremes.slowestModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.slowestModel ? formatDuration(stats.extremes.slowestModel.avgPerFeatureDurationMs) : '—'}</td>
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Highest Avg Rating</td>
                  <td className="px-3 py-2">{stats.extremes.highestRatedModel ? (<ModelChip provider={stats.extremes.highestRatedModel.provider} model={stats.extremes.highestRatedModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.highestRatedModel != null && stats.extremes.highestRatedModel.avgRating != null ? `${(stats.extremes.highestRatedModel.avgRating * 100).toFixed(0)}%` : '—'}</td>
                </tr>
                <tr className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">Lowest Avg Rating</td>
                  <td className="px-3 py-2">{stats.extremes.lowestRatedModel ? (<ModelChip provider={stats.extremes.lowestRatedModel.provider} model={stats.extremes.lowestRatedModel.model} />) : '—'}</td>
                  <td className="px-3 py-2">{stats.extremes.lowestRatedModel != null && stats.extremes.lowestRatedModel.avgRating != null ? `${(stats.extremes.lowestRatedModel.avgRating * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                  {stats.modelsList.sort((a,b) => (a.provider + a.model).localeCompare(b.provider + b.model)).map((m) => (
                    <tr key={m.key} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2"><ModelChip provider={m.provider} model={m.model} /></td>
                      <td className="px-3 py-2">{formatInteger(m.runs)}</td>
                      <td className="px-3 py-2">{formatUSD(m.totalCost)}</td>
                      <td className="px-3 py-2">{formatUSD(m.avgCost)}</td>
                      <td className="px-3 py-2">{formatInteger(m.avgTokens)}</td>
                      <td className="px-3 py-2">{formatDuration(m.avgPerFeatureDurationMs)}</td>
                      <td className="px-3 py-2">{m.avgRating != null ? `${(m.avgRating * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
