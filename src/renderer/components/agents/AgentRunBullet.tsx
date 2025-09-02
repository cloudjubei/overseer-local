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
  const label = `Agent ${run.runId.slice(0, 8)} · ${run.state}${run.progress != null ? ` · ${Math.round((run.progress ?? 0) * 100)}%` : ''}${run.message ? ` · ${run.message}` : ''}`;

  // Use the same chip classes as DependencyBullet for visual consistency
  // Default to chip--ok; state is additionally conveyed via the colored dot and accessible label
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="chip chip--ok flex items-center gap-1"
      style={{ lineHeight: 1 }}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} aria-hidden />
      <span className="hidden sm:inline">{run.state}</span>
    </button>
  );
}
