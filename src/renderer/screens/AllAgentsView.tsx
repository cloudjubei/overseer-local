import React, { useMemo } from 'react';
import { useAgents } from '../hooks/useAgents';

function formatUSD(n?: number) {
  if (n == null) return '\u2014';
  return `$${n.toFixed(4)}`;
}

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
function formatTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
}

export default function AllAgentsView() {
  const { runs, activeRuns } = useAgents();

  const agentsSummary = useMemo(() => {
    const totalRuns = runs.length;
    const active = activeRuns.length;
    const totals = runs.reduce((acc, r) => {
      acc.cost += r.costUSD ?? 0;
      acc.prompt += r.promptTokens ?? 0;
      acc.completion += r.completionTokens ?? 0;
      return acc;
    }, { cost: 0, prompt: 0, completion: 0 });

    const byModel = new Map<string, { model: string; provider: string; count: number; cost: number; prompt: number; completion: number; lastUpdated?: string }>();
    for (const r of runs) {
      const model = r.model ?? 'unknown';
      const provider = r.provider ?? 'unknown';
      const key = `${provider}::${model}`;
      const cur = byModel.get(key) ?? { model, provider, count: 0, cost: 0, prompt: 0, completion: 0, lastUpdated: undefined };
      cur.count += 1;
      cur.cost += r.costUSD ?? 0;
      cur.prompt += r.promptTokens ?? 0;
      cur.completion += r.completionTokens ?? 0;
      if (!cur.lastUpdated || (r.updatedAt && r.updatedAt > cur.lastUpdated)) cur.lastUpdated = r.updatedAt;
      byModel.set(key, cur);
    }

    const modelRows = Array.from(byModel.values()).map(m => ({
      ...m,
      avgCost: m.count ? m.cost / m.count : 0,
    })).sort((a, b) => b.cost - a.cost);

    return { totalRuns, active, totals, modelRows };
  }, [runs, activeRuns]);

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
            <div className="text-lg font-semibold">{agentsSummary.totalRuns}</div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Active Runs</div>
            <div className="text-lg font-semibold">{agentsSummary.active}</div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Total Cost</div>
            <div className="text-lg font-semibold">{formatUSD(agentsSummary.totals.cost)}</div>
          </div>
          <div className="rounded-md border p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <div className="text-xs text-neutral-500">Avg Cost/Run</div>
            <div className="text-lg font-semibold">{formatUSD(agentsSummary.totalRuns ? agentsSummary.totals.cost / agentsSummary.totalRuns : 0)}</div>
          </div>
        </div>

        {/* Model leaderboard */}
        <div>
          <h3 className="text-base font-semibold mb-2">Model Performance</h3>
          {agentsSummary.modelRows.length === 0 ? (
            <div className="text-sm text-neutral-500">No runs yet.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Provider</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-right px-3 py-2">Runs</th>
                    <th className="text-right px-3 py-2">Total Cost</th>
                    <th className="text-right px-3 py-2">Avg Cost</th>
                    <th className="text-right px-3 py-2">Tokens (P/C)</th>
                    <th className="text-right px-3 py-2">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {agentsSummary.modelRows.map((m) => (
                    <tr key={`${m.provider}::${m.model}`} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2">{m.provider}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.model}</td>
                      <td className="px-3 py-2 text-right">{m.count}</td>
                      <td className="px-3 py-2 text-right">{formatUSD(m.cost)}</td>
                      <td className="px-3 py-2 text-right">{formatUSD(m.avgCost)}</td>
                      <td className="px-3 py-2 text-right">{m.prompt} / {m.completion}</td>
                      <td className="px-3 py-2 text-right">{formatDate(m.lastUpdated)}<br/>{formatTime(m.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent runs */}
        <div>
          <h3 className="text-base font-semibold mb-2">Recent Runs</h3>
          {runs.length === 0 ? (
            <div className="text-sm text-neutral-500">No runs yet.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Project</th>
                    <th className="text-left px-3 py-2">Task/Feature</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">State</th>
                    <th className="text-left px-3 py-2">Message</th>
                    <th className="text-right px-3 py-2">Cost</th>
                    <th className="text-right px-3 py-2">Tokens</th>
                    <th className="text-right px-3 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice().sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map((r) => (
                    <tr key={r.runId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2 font-mono text-xs">{r.runId.slice(0,8)}</td>
                      <td className="px-3 py-2">{r.projectId}</td>
                      <td className="px-3 py-2">{r.taskId ?? ''}<br/>{r.featureId ? `${r.featureId}` : ''}</td>
                      <td className="px-3 py-2">{r.provider ?? ''}<br/>{r.model ? `${r.model}` : ''}</td>
                      <td className="px-3 py-2">{r.state}</td>
                      <td className="px-3 py-2 truncate max-w-[320px]" title={r.message ?? ''}>{r.message ?? '\u2014'}</td>
                      <td className="px-3 py-2 text-right">{formatUSD(r.costUSD)}</td>
                      <td className="px-3 py-2 text-right">{(r.promptTokens ?? 0)} / {(r.completionTokens ?? 0)}</td>
                      <td className="px-3 py-2 text-right">{formatDate(r.updatedAt)}<br/>{formatTime(r.updatedAt)}</td>
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
