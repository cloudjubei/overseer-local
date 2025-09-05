import React, { useEffect, useMemo, useState } from 'react';
import type { AgentRun, AgentRunMessage } from '../../services/agentsService';
import DependencyBullet from '../tasks/DependencyBullet';
import StatusChip from './StatusChip';
import ModelChip from './ModelChip';
import { IconChevron, IconDelete } from '../ui/Icons';
import ProjectChip from './ProjectChip';
import CostChip from './CostChip';
import TokensChip from './TokensChip';

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

function formatDuration(ms?: number) {
  if (ms == null || !isFinite(ms) || ms < 0) return '—';
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

// Determine features counts from messagesLog
function useFeatureCounts(run: AgentRun) {
  return useMemo(() => {
    const logs = run.messagesLog ? Object.values(run.messagesLog) : [];
    const total = logs.length;
    let completed = 0;
    for (const l of logs) {
      if ((l as any).endDate) completed++;
    }
    return { total, completed };
  }, [run.messagesLog]);
}

// Thinking timer based on time since last LLM message was received (assistant or tools), independent of heartbeats.
function useThinkingTimer(run: AgentRun) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (run.state !== 'running') return; 
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [run.state]);

  const lastMsgTs = run.lastMessageAt || run.startedAt || run.updatedAt;
  const lastUpdate = useMemo(() => {
    try {
      return new Date(lastMsgTs || Date.now()).getTime();
    } catch {
      return Date.now();
    }
  }, [lastMsgTs]);

  const ms = Math.max(0, now - lastUpdate);
  return formatDuration(run.state === 'running' ? ms : 0);
}

export interface AgentRunRowProps {
  run: AgentRun;
  onView?: (runId: string) => void;
  onCancel?: (runId: string) => void;
  onDelete?: (runId: string) => void;
  showActions?: boolean;
  showProject?: boolean;
  showModel?: boolean;
  // New display controls
  showStatus?: boolean; // default true
  showFeaturesInsteadOfTurn?: boolean; // default true
  showThinking?: boolean; // default false
}

export default function AgentRunRow({
  run,
  onView,
  onCancel,
  onDelete,
  showActions = true,
  showProject = false,
  showModel = true,
  showStatus = true,
  showFeaturesInsteadOfTurn = true,
  showThinking = false,
}: AgentRunRowProps) {
  const started = useMemo(() => new Date(run.startedAt || run.updatedAt || Date.now()), [run.startedAt, run.updatedAt]);
  const ended = useMemo(() => (run.state === 'running' ? new Date() : new Date(run.updatedAt || Date.now())), [run.state, run.updatedAt]);
  const durationMs = Math.max(0, ended.getTime() - started.getTime());
  const { total, completed } = useFeatureCounts(run);
  const thinking = useThinkingTimer(run);

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
      {showStatus ? (
        <td className="px-3 py-2">
          <StatusChip state={run.state} />
        </td>
      ) : null}
      {showModel ? (
        <td className="px-3 py-2">
          <ModelChip provider={run.provider} model={run.model} />
        </td>
      ) : null}
      {showFeaturesInsteadOfTurn ? (
        <td className="px-3 py-2">
          <span className="text-xs">{completed}/{total}</span>
        </td>
      ) : null}
      <td className="px-3 py-2"><CostChip provider={run.provider} model={run.model} costUSD={run.costUSD} /></td>
      <td className="px-3 py-2"><TokensChip run={run} /></td>
      {showThinking ? (
        <td className="px-3 py-2">{thinking}</td>
      ) : null}
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
            {run.state !== 'running' && onDelete && run.runId ? (
              <button className="btn-secondary btn-icon" aria-label="Delete" onClick={() => onDelete(run.runId!)}>
                <IconDelete />
              </button>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
