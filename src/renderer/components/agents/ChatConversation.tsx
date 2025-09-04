import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentRun, AgentRunMessage } from '../../services/agentsService';
import RichText from '../ui/RichText';

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
      <pre className="text-xs whitespace-pre-wrap break-words">{open ? str : str.slice(0, maxChars) + '\u2026'}</pre>
      <button className="btn-link text-xs mt-1" onClick={() => setOpen(v => !v)}>{open ? 'Show less' : 'Show more'}</button>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50" onClick={() => setOpen(v => !v)}>
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-neutral-500">{open ? '\u2212' : '+'}</span>
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
          <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 max-h-60 overflow-auto">
            <JsonPreview value={args} maxChars={400} />
          </div>
        )}
      </div>
      {resultText != null && (
        <div className="px-3 pb-3">
          <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Result</div>
          {isHeavy ? (
            <Collapsible title={<span>View result</span>}>
              <div className="text-xs whitespace-pre-wrap break-words"><RichText text={resultText} /></div>
            </Collapsible>
          ) : (
            <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
              <RichText text={resultText} />
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
      if (i > 0) out.push(ln.substring(i + ' returned: '.length + 'Tool '.length + (ln.startsWith('Tool ') ? 0 : 0))); // Keep right side after 'returned: '
      else out.push(ln);
    } else {
      out.push(ln);
    }
  }
  return out;
}

// Build conversation turns sequentially to ensure full history renders even if 'turn' is missing
function useTurnBundles(messages: AgentRunMessage[] | undefined) {
  return useMemo(() => {
    const systemMsgs: AgentRunMessage[] = [];

    type Turn = { index: number; user?: AgentRunMessage; assistant?: AgentRunMessage; tools?: AgentRunMessage };
    const turns: Turn[] = [];
    let current: Turn | null = null;

    const isToolMsg = (m: AgentRunMessage) => {
      const content = m.content || '';
      // Tool messages may be persisted with role 'tool' or with role 'user' but content prefixed
      const hinted = (m as any).source === 'tools';
      return m.role === 'tool' || hinted || content.startsWith('--- TOOL RESULTS ---');
    };

    for (const m of messages || []) {
      const role = m.role || '';

      // Collect first system prompt and any system messages separately
      if (role === 'system') {
        systemMsgs.push(m);
        continue;
      }

      // Tool results should attach to the current turn, not start a new user turn
      if (isToolMsg(m)) {
        if (!current) current = { index: turns.length };
        current.tools = m;
        // When tools are attached, we close the turn and start a new one next time
        turns.push(current);
        current = null;
        continue;
      }

      if (role === 'user') {
        // Regular user messages begin a new turn (e.g., for task runs without features)
        if (current && (current.user || current.assistant || current.tools)) {
          turns.push(current);
          current = null;
        }
        current = { index: turns.length, user: m };
        continue;
      }

      if (role === 'assistant') {
        if (!current) current = { index: turns.length };
        current.assistant = m;
        // Do not push yet; we might receive tool results next
        continue;
      }

      // Fallback: if message type doesn't match, keep it as a system info
      systemMsgs.push(m);
    }

    // If there's a dangling turn (e.g., final assistant message requesting finish), push it
    if (current && (current.user || current.assistant || current.tools)) {
      turns.push(current);
    }

    return { systemMsgs, turns } as { systemMsgs: AgentRunMessage[]; turns: { index: number; user?: AgentRunMessage; assistant?: AgentRunMessage; tools?: AgentRunMessage }[] };
  }, [messages]);
}

function isLargeText(text?: string) {
  if (!text) return false;
  const len = text.length;
  const lines = text.split(/\r?\n/).length;
  return len > 800 || lines > 16;
}

function ScrollableTextBox({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <div className="rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
        <RichText text={text} />
      </div>
    </div>
  );
}

export default function ChatConversation({ run }: { run: AgentRun }) {
  const lastTurnRef = useRef<HTMLLIElement | null>(null);
  const { systemMsgs, turns } = useTurnBundles(run.messages);

  // Scroll to last turn on initial open and whenever turn count changes
  useEffect(() => {
    if (lastTurnRef.current) {
      lastTurnRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [turns.length]);

  const systemPrompt = useMemo(() => {
    // Prefer first system role message; fallback to the bootstrap message containing #CURRENT TASK
    const m = systemMsgs[0];
    return m?.content;
  }, [systemMsgs, run.messages]);

  const lastIndex = turns.length - 1;

  return (
    <div className="h=[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3">
      {systemPrompt ? (
        <Collapsible title={<span>System prompt</span>} defaultOpen={false}>
          {isLargeText(systemPrompt) ? (
            <ScrollableTextBox text={systemPrompt} />
          ) : (
            <div className="text-xs whitespace-pre-wrap break-words"><RichText text={systemPrompt} /></div>
          )}
        </Collapsible>
      ) : null}

      {turns.length === 0 ? (
        <div className="text-sm text-neutral-500">No conversation yet.</div>
      ) : (
        <ul className="space-y-3">
          {turns.map(({ index, user, assistant, tools }) => {
            const parsed = assistant ? parseAssistant(assistant.content || '') : null;
            const toolCalls = parsed?.tool_calls || [];
            const results = parseToolResultsMessage(tools);

            // Build a short title for the turn header
            const titleParts: string[] = [];
            titleParts.push(`Turn ${index + 1}`);
            if ((assistant as any)?.durationMs) titleParts.push(`${(assistant as any).durationMs}ms`);
            const title = titleParts.join(' \u00b7 ');

            const isLast = index === lastIndex;

            return (
              <li key={index} ref={isLast ? lastTurnRef : undefined}>
                <Collapsible title={<span className="flex items-center gap-2">{title}</span>} defaultOpen={isLast}>
                  <div className="space-y-2">
                    {user ? (
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50 shadow-sm">
                        <div className="text-[11px] font-medium mb-1">User</div>
                        {isLargeText(user.content) ? (
                          <ScrollableTextBox text={user.content || ''} />
                        ) : (
                          <div className="text-xs whitespace-pre-wrap break-words"><RichText text={user.content} /></div>
                        )}
                      </div>
                    ) : null}

                    {parsed?.thoughts ? (
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100 shadow-sm">
                        {isLargeText(parsed.thoughts) ? (
                          <ScrollableTextBox text={parsed.thoughts || ''} />
                        ) : (
                          <div className="text-xs whitespace-pre-wrap break-words"><RichText text={parsed.thoughts} /></div>
                        )}
                      </div>
                    ) : assistant ? (
                      <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 shadow-sm">
                        <div className="text-[11px] font-medium mb-1">Assistant</div>
                        {isLargeText(assistant.content) ? (
                          <ScrollableTextBox text={assistant.content || ''} />
                        ) : (
                          <div className="text-xs whitespace-pre-wrap break-words"><RichText text={assistant.content} /></div>
                        )}
                      </div>
                    ) : null}

                    {toolCalls.length > 0 ? (
                      <div className="space-y-2">
                        {toolCalls.map((call, i) => (
                          <ToolCallRow key={i} call={call} index={i} resultText={results[i]} />
                        ))}
                      </div>
                    ) : null}

                    {toolCalls.length === 0 && results.length > 0 ? (
                      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-2">
                        <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Tool results</div>
                        {results.map((r, i) => (
                          <div key={i} className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 mb-2 last:mb-0 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
                            <RichText text={r} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
