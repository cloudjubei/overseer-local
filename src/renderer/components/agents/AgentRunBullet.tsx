import React from 'react';
import type { AgentRun } from '../../services/agentsService';
import StatusChip from './StatusChip';

export default function AgentRunBullet({ run, onClick }: { run: AgentRun; onClick?: (e: any) => void }) {
  const providerModel = [run.provider, run.model].filter(Boolean).join(' · ');
  const label = `Agent ${run.runId.slice(0, 8)} · ${run.state}${run.progress != null ? ` · ${Math.round((run.progress ?? 0) * 100)}%` : ''}${run.message ? ` · ${run.message}` : ''}${providerModel ? ` · ${providerModel}` : ''}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center p-0 m-0 bg-transparent border-0"
      style={{ lineHeight: 1 }}
    >
      <StatusChip state={run.state} />
    </button>
  );
}
