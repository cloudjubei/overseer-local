import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentRun, AgentRunMessage } from '../../services/agentsService';

// Parse assistant JSON response to extract thoughts and tool calls safely
function parseAssistant(content: string): { thoughts?: string; tool_calls?: { tool_name?: string; tool?: string; name?: string; arguments?: any; parameters?: any }[] } | null {
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === 'object') return obj;
    return null;
  } catch {
    return null;
  }
}

function classNames(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(' ');
}

function JsonPreview({ value, maxChars = 200 }: { value: any; maxChars?: number }) {
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxChars) return (<pre className="text-xs whitespace-pre-wrap break-words">{str}</pre>);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <pre className="text-xs whitespace-pre-wrap break-words">{open ? str : str.slice(0, maxChars) + '…'}</pre>
      <button className="btn-link text-xs mt-1" onClick={() => setOpen(v => !v)}>{open ? 'Show less' : 'Show more'}</button>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50" onClick={() => setOpen(v => !v)}>
        <span className="text-xs font-medium">{title}</span>
        <span className="text-xs text-neutral-500">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="px-3 py-2 border-t border-neutral-200 dark:border-neutral-800">{children}</div>
      ) : null}
    </div>
  );
}

function ToolCallRow({ call, resultText, index }: { call: any; resultText?: string; index: number }) {
  const name = call.tool_name || call.tool || call.name || 'tool';
  const args = call.arguments ?? call.parameters ?? {};
  const isHeavy = name === 'read_files' || name === 'write_file';

  return (
    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40">
      <div className="px-3 py-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold">{index + 1}. {name}</div>
          <div className="text-[11px] text-neutral-600 dark:text-neutral-400">Arguments</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        {isHeavy ? (
          <Collapsible title={<span>View arguments</span>}>
            <JsonPreview value={args} maxChars={500} />
          </Collapsible>
        ) : (
          <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2">
            <JsonPreview value={args} maxChars={400} />
          </div>
        )}
      </div>
      {resultText != null && (
        <div className="px-3 pb-3">
          <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Result</div>
          {isHeavy ? (
            <Collapsible title={<span>View result</span>}>
              <pre className="text-xs whitespace-pre-wrap break-words">{resultText}</pre>
            </Collapsible>
          ) : (
            <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2">
              <pre className="text-xs whitespace-pre-wrap break-words">{resultText}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseToolResultsMessage(msg?: AgentRunMessage): string[] {
  if (!msg) return [];
  const s = msg.content || '';
  const lines = s.split(/\r?\n/);
  const out: string[] = [];
  for (const ln of lines) {
    if (!ln) continue;
    if (ln.startsWith('---')) continue; // header line
    if (ln.startsWith('Tool ')) {
      const i = ln.indexOf(' returned: ');
      if (i > 0) out.push(ln.substring(i + ' returned: '.length + 'Tool '.length + (ln.startsWith('Tool ') ? 0 : 0))); // We'll keep entire right side after 'returned: '
      else out.push(ln);
    } else {
      out.push(ln);
    }
  }
  return out;
}

// Bundle messages by turn so assistant response and corresponding tool results are shown together
function useTurnBundles(messages: AgentRunMessage[] | undefined) {
  return useMemo(() => {
    const byTurn = new Map<number, { assistant?: AgentRunMessage; tools?: AgentRunMessage }>();
    const systemMsgs: AgentRunMessage[] = [];
    for (const m of messages || []) {
      if (typeof m.turn !== 'number') {
        systemMsgs.push(m);
        continue;
      }
      const b = byTurn.get(m.turn) || {};
      if (m.role === 'assistant') b.assistant = m;
      else if (m.source === 'tools' || (m.content || '').startsWith('--- TOOL RESULTS ---')) b.tools = m;
      byTurn.set(m.turn, b);
    }
    const ordered = Array.from(byTurn.entries()).sort((a, b) => a[0] - b[0]).map(([turn, data]) => ({ turn, ...data }));
    return { systemMsgs, turns: ordered } as { systemMsgs: AgentRunMessage[]; turns: { turn: number; assistant?: AgentRunMessage; tools?: AgentRunMessage }[] };
  }, [messages]);
}

export default function ChatConversation({ run }: { run: AgentRun }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { systemMsgs, turns } = useTurnBundles(run.messages);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run?.messages?.length]);

  // Try to find the initial system prompt
  const systemPrompt = useMemo(() => {
    const m = systemMsgs.find(x => x.role === 'user' && (x.content || '').includes('#CURRENT TASK')) || systemMsgs[0];
    return m?.content;
  }, [systemMsgs]);

  return (
    <div className="h-[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3">
      {systemPrompt ? (
        <Collapsible title={<span>System prompt</span>} defaultOpen={false}>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto">{systemPrompt}</pre>
        </Collapsible>
      ) : null}

      {turns.length === 0 ? (
        <div className="text-sm text-neutral-500">No conversation yet.</div>
      ) : (
        <ul className="space-y-4">
          {turns.map(({ turn, assistant, tools }) => {
            const parsed = assistant ? parseAssistant(assistant.content || '') : null;
            const toolCalls = parsed?.tool_calls || [];
            const results = parseToolResultsMessage(tools);

            return (
              <li key={turn} className="space-y-2">
                <div className="text-[11px] text-neutral-500">Turn {turn + 1}{assistant?.durationMs ? ` · ${assistant.durationMs}ms` : ''}</div>
                {/* Thoughts bubble */}
                {parsed?.thoughts ? (
                  <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 shadow-sm">
                    <div className="text-xs whitespace-pre-wrap break-words">{parsed.thoughts}</div>
                  </div>
                ) : assistant ? (
                  <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 shadow-sm">
                    <div className="text-[11px] font-medium mb-1">Assistant</div>
                    <div className="text-xs whitespace-pre-wrap break-words">{assistant.content}</div>
                  </div>
                ) : null}

                {/* Tool calls list */}
                {toolCalls.length > 0 ? (
                  <div className="space-y-2">
                    {toolCalls.map((call, i) => (
                      <ToolCallRow key={i} call={call} index={i} resultText={results[i]} />
                    ))}
                  </div>
                ) : null}

                {/* If there are tool results but no parsed tool calls (fallback) */}
                {toolCalls.length === 0 && results.length > 0 ? (
                  <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-2">
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Tool results</div>
                    {results.map((r, i) => (
                      <div key={i} className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 mb-2 last:mb-0">
                        <pre className="text-xs whitespace-pre-wrap break-words">{r}</pre>
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
          <div ref={bottomRef} />
        </ul>
      )}
    </div>
  );
}
