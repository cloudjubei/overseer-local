import React, { useEffect, useMemo, useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useActiveProject } from '../projects/ProjectContext';
import type { AgentRun } from '../services/agentsService';
import ChatConversation from '../components/agents/ChatConversation';
import AgentRunRow from '../components/agents/AgentRunRow';
import ModelChip from '../components/agents/ModelChip';

function formatTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString();
  } catch {
    return iso ?? '';
  }
}

export default function AgentsView() {
  const { runs, activeRuns, cancelRun, removeRun } = useAgents();
  const { projectId } = useActiveProject();
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  // Active runs for this project, sorted newest first
  const activeProjectRuns = useMemo(
    () => activeRuns
      .filter(r => r.projectId === projectId)
      .slice()
      .sort((a,b) => (b.startedAt || '').localeCompare(a.startedAt || '')),
    [activeRuns, projectId]
  );

  // All runs for this project excluding those currently active, sorted newest first
  const projectRuns = useMemo(() => {
    const allProjectRuns = runs.filter(r => r.projectId === projectId);
    let filtered = allProjectRuns;
    if (activeProjectRuns.length > 0) {
      const activeIds = new Set(activeProjectRuns.map(r => r.runId));
      filtered = allProjectRuns.filter(r => !activeIds.has(r.runId));
    }
    return filtered.slice().sort((a,b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }, [runs, projectId, activeProjectRuns]);

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
    return projectRuns.find(r => r.runId === id) || activeProjectRuns.find(r => r.runId === id);
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
            <div className="overflow-auto border rounded-md border-neutral-200 dark:border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                  <tr>
                    <th className="text-left px-3 py-2">Run</th>
                    <th className="text-left px-3 py-2">Task</th>
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
                  {activeProjectRuns.map(r => (
                    <AgentRunRow
                      key={r.runId ?? Math.random().toString(36)}
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
                    <th className="text-left px-3 py-2">Task</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Model</th>
                    <th className="text-left px-3 py-2">Features</th>
                    <th className="text-left px-3 py-2">Cost</th>
                    <th className="text-left px-3 py-2">Tokens</th>
                    <th className="text-left px-3 py-2">Duration</th>
                    <th className="text-right px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRuns.map(r => (
                    <AgentRunRow
                      key={r.runId ?? Math.random().toString(36)}
                      run={r}
                      onView={(id) => setOpenRunId(id)}
                      onCancel={(id) => cancelRun(id)}
                      onDelete={(id) => removeRun(id)}
                      showModel
                      showStatus={true}
                      showFeaturesInsteadOfTurn={true}
                      showThinking={false}
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
                <div className="font-semibold text-sm truncate">Run #{selectedRun.runId.slice(0,8)} {selectedRun.taskId ?? 'Task'}</div>
                <div className="text-xs text-neutral-500 truncate flex items-center gap-2">
                  <ModelChip provider={selectedRun.provider} model={selectedRun.model} />
                  <span>{selectedRun.state} Updated {formatTime(selectedRun.updatedAt)}</span>
                </div>
              </div>
              <button className="btn-secondary" onClick={() => setOpenRunId(null)}>Close</button>
            </div>
            <ChatConversation run={selectedRun} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
