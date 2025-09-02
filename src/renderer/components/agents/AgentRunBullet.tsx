import React from 'react';
import type { AgentRun } from '../../services/agentsService';

function stateColor(state: AgentRun['state']) {
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

export default function AgentRunBullet({ run, onClick }: { run: AgentRun; onClick?: () => void }) {
  const color = stateColor(run.state);
  const label = `Agent ${run.runId.slice(0,8)} · ${run.state}${run.progress != null ? ` · ${Math.round((run.progress ?? 0) * 100)}%` : ''}${run.message ? ` · ${run.message}` : ''}`;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
      style={{ lineHeight: 1 }}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />
      <span className="hidden sm:inline text-neutral-700 dark:text-neutral-300">{run.state}</span>
    </button>
  );
}
