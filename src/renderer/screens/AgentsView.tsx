import React, { useEffect, useMemo } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useProjectContext } from '../projects/ProjectContext';

function formatUSD(n?: number) {
  if (n == null) return '\u2014';
  return `$${n.toFixed(4)}`;
}

function formatTs(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso;
  }
}

export default function AgentsView() {
  const { runs, activeRuns, cancelRun } = useAgents();
  const { activeProjectId } = useProjectContext();

  const projectRuns = useMemo(() => runs.filter(r => r.projectId === activeProjectId), [runs, activeProjectId]);
  const activeProjectRuns = useMemo(() => activeRuns.filter(r => r.projectId === activeProjectId), [activeRuns, activeProjectId]);

  useEffect(() => {
    // If hash contains an anchor like #agents/run/<id>, scroll to that run if present.
    const hash = (window.location.hash || '').replace(/^#/, '');
    const m = /^agents\/run\/(.+)$/.exec(hash);
    if (m && m[1]) {
      const id = m[1];
      // Defer scroll until after list renders
      setTimeout(() => {
        const el = document.getElementById(`run-${id}`);
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          el.classList.add('highlighted');
          setTimeout(() => el.classList.remove('highlighted'), 2000);
        }
      }, 0);
    }
  }, [projectRuns.length]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="text-lg font-semibold">Agents</div>
        <div className="text-sm text-neutral-600 dark:text-neutral-400">Monitor running agents, usage and costs</div>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Active ({activeProjectRuns.length})</h2>
          </div>
          {activeProjectRuns.length === 0 ? (
            <div className="text-sm text-neutral-500">No active agents.</div>
          ) : (
            <ul className="space-y-2">
              {activeProjectRuns.map(run => (
                <li id={`run-${run.runId}`} key={run.runId} className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        #{run.runId.slice(0, 8)} · {run.taskId ? `Task ${run.taskId}` : 'Task'}{run.featureId ? ` · Feature ${run.featureId}` : ''}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 truncate">{run.message ?? 'Running...'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">{run.state}</span>
                      <button className="btn-secondary" onClick={() => cancelRun(run.runId)}>Cancel</button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="rounded bg-neutral-50 dark:bg-neutral-800 p-2">
                      <div className="text-neutral-500">Progress</div>
                      <div className="font-medium">{run.progress != null ? `${Math.round((run.progress ?? 0) * 100)}%` : '\u2014'}</div>
                    </div>
                    <div className="rounded bg-neutral-50 dark:bg-neutral-800 p-2">
                      <div className="text-neutral-500">Cost</div>
                      <div className="font-medium">{formatUSD(run.costUSD)}</div>
                    </div>
                    <div className="rounded bg-neutral-50 dark:bg-neutral-800 p-2">
                      <div className="text-neutral-500">Tokens</div>
                      <div className="font-medium">{run.promptTokens ?? 0} / {run.completionTokens ?? 0}</div>
                    </div>
                    <div className="rounded bg-neutral-50 dark:bg-neutral-800 p-2">
                      <div className="text-neutral-500">Updated</div>
                      <div className="font-medium">{formatTs(run.updatedAt)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">History ({projectRuns.length})</h2>
          </div>
          {projectRuns.length === 0 ? (
            <div className="text-sm text-neutral-500">No runs yet for this project.</div>
          ) : (
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Task/Feature</th>
                    <th className="text-left px-3 py-2">State</th>
                    <th className="text-left px-3 py-2">Message</th>
                    <th className="text-left px-3 py-2">Cost</th>
                    <th className="text-left px-3 py-2">Tokens</th>
                    <th className="text-left px-3 py-2">Started</th>
                    <th className="text-left px-3 py-2">Updated</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRuns.map(r => (
                    <tr id={`run-${r.runId}`} key={r.runId} className="border-t border-neutral-200 dark:border-neutral-800">
                      <td className="px-3 py-2 font-mono text-xs">{r.runId.slice(0,8)}</td>
                      <td className="px-3 py-2">{r.taskId ?? '\u2014'}{r.featureId ? ` · ${r.featureId}` : ''}</td>
                      <td className="px-3 py-2">{r.state}</td>
                      <td className="px-3 py-2 truncate max-w-[280px]" title={r.message ?? ''}>{r.message ?? '\u2014'}</td>
                      <td className="px-3 py-2">{formatUSD(r.costUSD)}</td>
                      <td className="px-3 py-2">{r.promptTokens ?? 0} / {r.completionTokens ?? 0}</td>
                      <td className="px-3 py-2">{formatTs(r.startedAt)}</td>
                      <td className="px-3 py-2">{formatTs(r.updatedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        {r.state === 'running' ? (
                          <button className="btn-secondary" onClick={() => cancelRun(r.runId)}>Cancel</button>
                        ) : (
                          <span className="text-neutral-400">\u2014</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
