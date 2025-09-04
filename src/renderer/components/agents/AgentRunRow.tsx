import React, { useMemo } from 'react';
import type { AgentRun } from '../../services/agentsService';
import DependencyBullet from '../tasks/DependencyBullet';
import StatusChip from './StatusChip';
import TurnChip from './TurnChip';
import ModelChip from './ModelChip';
import { IconChevron, IconDelete } from '../ui/Icons';
import ProjectChip from './ProjectChip';
import CostChip from './CostChip';
import TokensChip from './TokensChip';

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

function countTurns(messages: AgentRun['messages']): number {
  if (!messages || messages.length === 0) return 0;
  let turns = 0;
  let hasAssistant = false;
  for (const m of messages) {
    if ((m.role || '').toLowerCase() === 'user') turns++;
    if ((m.role || '').toLowerCase() === 'assistant') hasAssistant = true;
  }
  if (turns === 0 && hasAssistant) return 1;
  return turns;
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

export interface AgentRunRowProps {
  run: AgentRun;
  onView?: (runId: string) => void;
  onCancel?: (runId: string) => void;
  showActions?: boolean;
  showProject?: boolean;
  showModel?: boolean;
}

export default function AgentRunRow({ run, onView, onCancel, showActions = true, showProject = false, showModel = true }: AgentRunRowProps) {
  const turns = countTurns(run.messages);
  const started = useMemo(() => new Date(run.startedAt || run.updatedAt || Date.now()), [run.startedAt, run.updatedAt]);
  const ended = useMemo(() => (run.state === 'running' ? new Date() : new Date(run.updatedAt || Date.now())), [run.state, run.updatedAt]);
  const durationMs = Math.max(0, ended.getTime() - started.getTime());

  return (
    <tr id={`run-${run.runId ?? 'unknown'}`} className="border-t border-neutral-200 dark:border-neutral-800 group">
      <td className="px-3 py-2 leading-tight">
        <div>{formatDate(run.startedAt)}</div>
        <div className="text-neutral-500">{formatTime(run.startedAt)}</div>
      </td>
      {showProject ? (
        <td className="px-3 py-2"><ProjectChip projectId={run.projectId} /></td>
      ) : null}
      <td className="px-3 py-2">
        <DependencyBullet className={"max-w-[100px] overflow-clip"} dependency={run.taskId} notFoundDependencyDisplay={"?"} />
      </td>
      <td className="px-3 py-2">
        <StatusChip state={run.state} />
      </td>
      {showModel ? (
        <td className="px-3 py-2">
          <ModelChip provider={run.provider} model={run.model} />
        </td>
      ) : null}
      <td className="px-3 py-2">
        <TurnChip turn={turns} />
      </td>
      <td className="px-3 py-2"><CostChip provider={run.provider} model={run.model} costUSD={run.costUSD} /></td>
      <td className="px-3 py-2"><TokensChip run={run} /></td>
      <td className="px-3 py-2">{formatDuration(durationMs)}</td>
      {showActions ? (
        <td className="px-3 py-2 text-right">
          <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            {onView ? (
              <button className="btn-secondary btn-icon" aria-label="View" onClick={() => run.runId && onView(run.runId!)}>
                <IconChevron />
              </button>
            ) : null}
            {run.state === 'running' && onCancel && run.runId ? (
              <button className="btn-secondary btn-icon" aria-label="Cancel" onClick={() => onCancel(run.runId!)}>
                <IconDelete />
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
