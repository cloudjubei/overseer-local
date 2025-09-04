import React, { useMemo } from 'react';
import { useAgents } from '../hooks/useAgents';
import AgentRunRow from '../components/agents/AgentRunRow';

function formatUSD(n?: number) {
  if (n == null) return '\u2014';
  return `$${n.toFixed(4)}`;
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

    return { totalRuns, active, totals };
  }, [runs, activeRuns]);

  const recentRuns = useMemo(() => runs.slice().sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 200), [runs]);

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

        {/* Recent runs - styled similar to project AgentsView table, with an extra Project column */}
        <div>
          <h3 className="text-base font-semibold mb-2">Recent Runs</h3>
          {recentRuns.length === 0 ? (
            <div className="text-sm text-neutral-500">No runs yet.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Project</th>
                    <th className="text-left px-3 py-2">Task</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">Features</th>
                    <th className="text-left px-3 py-2">Cost</th>
                    <th className="text-left px-3 py-2">Tokens</th>
                    <th className="text-left px-3 py-2">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r) => (
                    <AgentRunRow key={r.runId} run={r} showActions={false} showProject={true} showModel showFeaturesInsteadOfTurn={true} />
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
