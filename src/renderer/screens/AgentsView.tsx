import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useActiveProject } from '../projects/ProjectContext';
import type { AgentRun } from '../services/agentsService';
import ChatConversation from '../components/agents/ChatConversation';
import { IconChevron, IconDelete } from '../components/ui/Icons';

function formatUSD(n?: number) {
  if (n == null) return '\u2014';
  return `$${n.toFixed(4)}`;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso ?? '';
  }
}

function formatDate(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso ?? '';
  }
}

function stateDotColor(state: AgentRun['state']) {
  switch (state) {
    case 'running':
      return 'bg-blue-500';
    case 'completed':
      return 'bg-green-500';
    case 'cancelled':
      return 'bg-neutral-400';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-neutral-400';
  }
}

export default function AgentsView() {
  const { runs, activeRuns, cancelRun } = useAgents();
  const { projectId } = useActiveProject();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const projectRuns = useMemo(() => runs.filter(r => r.projectId === projectId), [runs, projectId]);
  const activeProjectRuns = useMemo(() => activeRuns.filter(r => r.projectId === projectId), [activeRuns, projectId]);

  useEffect(() => {
    const hash = (window.location.hash || '').replace(/^#/, '');
    const m = /^agents\/run\/(.+)$/.exec(hash);
    if (m && m[1]) {
      const id = m[1];
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

  const findRunById = (id: string | null): AgentRun | undefined => {
    if (!id) return undefined;
    return projectRuns.find(r => r.runId === id);
  };

  const selectedRun = findRunById(openRunId || '');

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
                <li id={`run-${run.runId ?? 'unknown'}`} key={run.runId ?? Math.random().toString(36)} className="border rounded-md p-3 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        #{(run.runId ?? '').slice(0, 8) || 'pending'} \u00b7 {run.taskId ? `Task ${run.taskId}` : 'Task'}{run.featureId ? ` \u00b7 Feature ${run.featureId}` : ''}
                      </div>
                      <div className="text-xs text-neutral-500 mt-0.5 truncate">{run.message ?? 'Running...'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${stateDotColor(run.state)}`} aria-label={run.state} title={run.state} />
                      <button className="btn-secondary" onClick={() => setOpenRunId(run.runId)}>View</button>
                      <button className="btn-secondary" onClick={() => run.runId && cancelRun(run.runId)}>Cancel</button>
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
                      <div className="font-medium leading-tight">
                        <div>{formatDate(run.updatedAt)}</div>
                        <div className="text-neutral-500">{formatTime(run.updatedAt)}</div>
                      </div>
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
                    <th className="text-left px-3 py-2">Status</th>
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
                    <tr id={`run-${r.runId ?? 'unknown'}`} key={r.runId ?? Math.random().toString(36)} className="border-t border-neutral-200 dark:border-neutral-800 group">
                      <td className="px-3 py-2 font-mono text-xs">{(r.runId ?? '').slice(-8) || ''}</td>
                      <td className="px-3 py-2">{r.taskId ?? ''}<br/>{r.featureId ?? ''}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${stateDotColor(r.state)}`} aria-label={r.state} title={r.state} />
                      </td>
                      <td className="px-3 py-2 truncate max-w-[280px]" title={r.message ?? ''}>{r.message ?? ''}</td>
                      <td className="px-3 py-2">{formatUSD(r.costUSD)}</td>
                      <td className="px-3 py-2">{r.promptTokens ?? 0} / {r.completionTokens ?? 0}</td>
                      <td className="px-3 py-2 leading-tight">
                        <div>{formatDate(r.startedAt)}</div>
                        <div className="text-neutral-500">{formatTime(r.startedAt)}</div>
                      </td>
                      <td className="px-3 py-2 leading-tight">
                        <div>{formatDate(r.updatedAt)}</div>
                        <div className="text-neutral-500">{formatTime(r.updatedAt)}</div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="btn-secondary btn-icon" aria-label="View" onClick={() => r.runId && setOpenRunId(r.runId)}>
                            <IconChevron />
                          </button>
                          {r.state === 'running' && r.runId ? (
                            <button className="btn-secondary btn-icon" aria-label="Cancel" onClick={() => cancelRun(r.runId!)}>
                              <IconDelete />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
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
                <div className="font-semibold text-sm truncate">Run #{selectedRun.runId.slice(0,8)} \u00b7 {selectedRun.taskId ?? 'Task'}{selectedRun.featureId ? ` \u00b7 Feature ${selectedRun.featureId}` : ''}</div>
                <div className="text-xs text-neutral-500 truncate">{selectedRun.provider ?? '\u2014'}{selectedRun.model ? ` / ${selectedRun.model}` : ''} \u00b7 {selectedRun.state} \u00b7 Updated {formatTime(selectedRun.updatedAt)}</div>
              </div>
              <button className="btn-secondary" onClick={() => setOpenRunId(null)}>Close</button>
            </div>
            <div className="p-4">
              <ChatConversation run={selectedRun} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
