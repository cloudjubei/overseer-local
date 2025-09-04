import React, { useMemo } from 'react';
import Tooltip from '../ui/Tooltip';
import type { AgentRun } from '../../services/agentsService';
import { IconArrowLeftMini, IconArrowRightMini } from '../ui/Icons';

export default function TokensChip({ run }: { run: AgentRun }) {
  const prompt = run.promptTokens ?? 0; // tokens sent to LLM
  const completion = run.completionTokens ?? 0; // tokens received from LLM

  const breakdown = useMemo(() => {
    const items = (run.messages || []).map((m, i) => {
      const role = m.role || 'message';
      const preview = (m.content || '').replace(/\s+/g, ' ').slice(0, 60);
      return { i: i + 1, role, preview };
    });
    return items;
  }, [run.messages]);

  const { userCount, assistantCount, avgPromptPerMsg, avgCompletionPerMsg } = useMemo(() => {
    const msgs = run.messages || [];
    const userCount = msgs.filter(m => (m.role || '').toLowerCase() === 'user').length;
    const assistantCount = msgs.filter(m => (m.role || '').toLowerCase() === 'assistant').length;
    const avgPromptPerMsg = userCount > 0 ? Math.round(prompt / userCount) : undefined;
    const avgCompletionPerMsg = assistantCount > 0 ? Math.round(completion / assistantCount) : undefined;
    return { userCount, assistantCount, avgPromptPerMsg, avgCompletionPerMsg };
  }, [run.messages, prompt, completion]);

  const content = (
    <div className="text-xs max-w-[360px]">
      <div className="font-semibold mb-1">Token usage</div>
      <div className="mb-1 text-neutral-400">Prompt: {prompt} · Completion: {completion} · Total: {prompt + completion}</div>
      <div className="mb-2">
        <div className="text-neutral-600 dark:text-neutral-300">Per-message averages</div>
        <div className="text-neutral-400">
          User ({userCount || 0}): {avgPromptPerMsg != null ? `${avgPromptPerMsg} tokens/msg` : '—'} ·
          {' '}
          Assistant ({assistantCount || 0}): {avgCompletionPerMsg != null ? `${avgCompletionPerMsg} tokens/msg` : '—'}
        </div>
      </div>
      <div className="font-semibold mb-1">Messages</div>
      <div className="space-y-0.5 max-h-[240px] overflow-auto pr-1">
        {breakdown.length === 0 ? (
          <div className="text-neutral-400">No messages</div>
        ) : (
          breakdown.map((b, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="truncate"><span className="text-neutral-400">#{b.i}</span> {b.role}{b.preview ? ': ' : ''}<span className="text-neutral-400">{b.preview}</span></div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <Tooltip content={content} placement="top">
      <span className="inline-flex flex-col items-start gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium bg-neutral-50 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 leading-3">
        <span className="flex items-center gap-1"><IconArrowLeftMini className="text-neutral-400" /><span>{prompt}</span></span>
        <span className="flex items-center gap-1"><IconArrowRightMini className="text-neutral-400" /><span>{completion}</span></span>
      </span>
    </Tooltip>
  );
}
