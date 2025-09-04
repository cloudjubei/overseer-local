import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentFeatureRunLog, AgentRun, AgentRunMessage } from '../../services/agentsService';
import RichText from '../ui/RichText';
import SafeText from '../ui/SafeText';
import { ToolResult } from 'packages/factory-ts/src/types';

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
              <div className="text-xs whitespace-pre-wrap break-words"><SafeText text={resultText} /></div>
            </Collapsible>
          ) : (
            <div className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
              <SafeText text={resultText} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Back-compat: parse tool results from mixed formats (preferred ToolResult JSON, else legacy lines)
export type ParsedToolResult = { name: string; result: string };

function parseToolResultsObjects(msg?: AgentRunMessage): ParsedToolResult[] {
  if (!msg?.content) return [];
  const text = msg.content.trim();
  // Try full JSON parse (array or object)
  try {
    const o = JSON.parse(text);
    if (Array.isArray(o)) {
      return o
        .filter(x => x && typeof x === 'object' && ('name' in x) && ('result' in x))
        .map(x => ({ name: String((x as any).name), result: String((x as any).result) }));
    }
    if (o && typeof o === 'object') {
      if ('name' in o && 'result' in o) {
        return [{ name: String((o as any).name), result: String((o as any).result) }];
      }
      if ('results' in o && Array.isArray((o as any).results)) {
        return (o as any).results
          .filter((x: any) => x && typeof x === 'object' && ('name' in x) && ('result' in x))
          .map((x: any) => ({ name: String(x.name), result: String(x.result) }));
      }
    }
  } catch {}
  // Fallback: try per-line JSON or legacy textual format
  const out: ParsedToolResult[] = [];
  for (const ln of text.split(/\r?\n/)) {
    const line = ln.trim();
    if (!line) continue;
    if (line.startsWith('---')) continue;
    try {
      const jo = JSON.parse(line);
      if (jo && typeof jo === 'object' && 'name' in jo && 'result' in jo) {
        out.push({ name: String((jo as any).name), result: String((jo as any).result) });
        continue;
      }
    } catch {}
    if (line.startsWith('Tool ')) {
      const nameMatch = /^Tool\s+([^\s:]+)(?::|\s)/.exec(line);
      const name = nameMatch ? nameMatch[1] : 'tool';
      const i = line.indexOf(' returned: ');
      const result = i >= 0 ? line.substring(i + ' returned: '.length) : line;
      out.push({ name, result });
    } else {
      out.push({ name: 'tool', result: line });
    }
  }
  return out;
}

// Build conversation turns. Prefer grouping by explicit message.turn when present; otherwise fall back to sequential bundling
function useTurnBundles(messages: AgentRunMessage[] | undefined) {
  return useMemo(() => {
    const systemMsgs: AgentRunMessage[] = [];

    type Turn = { index: number; turnNumber?: number; user?: AgentRunMessage; assistant?: AgentRunMessage; tools?: AgentRunMessage };

    const nonSystem: AgentRunMessage[] = [];
    for (const m of messages || []) {
      if ((m.role || '') === 'system') systemMsgs.push(m); else nonSystem.push(m);
    }

    const hasTurns = nonSystem.some(m => typeof m.turn === 'number' && isFinite(m.turn as any));

    const isToolMsg = (m: AgentRunMessage) => {
      const content = m.content || '';
      const hinted = (m as any).source === 'tools';
      return m.role === 'tool' || hinted || content.startsWith('--- TOOL RESULTS ---');
    };

    let turns: Turn[] = [];

    if (hasTurns) {
      const byTurn = new Map<number, Turn>();
      for (const m of nonSystem) {
        const t = typeof m.turn === 'number' && isFinite(m.turn) ? (m.turn as number) : Number.MAX_SAFE_INTEGER;
        if (!byTurn.has(t)) byTurn.set(t, { index: 0, turnNumber: t });
        const turn = byTurn.get(t)!;
        if (isToolMsg(m)) {
          turn.tools = m;
        } else if (m.role === 'user') {
          turn.user = m;
        } else if (m.role === 'assistant') {
          turn.assistant = m;
        }
      }
      // Sort by turn number; put "unassigned" (MAX_SAFE_INTEGER) at the end
      const sorted = Array.from(byTurn.values()).sort((a, b) => (a.turnNumber! - b.turnNumber!));
      turns = sorted.map((t, idx) => ({ ...t, index: idx }));

      // If every message ended up with the same turn (degenerate snapshot), fall back to sequential bundling
      const uniqTurns = new Set(sorted.map(t => t.turnNumber));
      if (uniqTurns.size <= 1) {
        turns = [];
        let current: Turn | null = null;
        for (const m of nonSystem) {
          if (isToolMsg(m)) {
            if (!current) current = { index: turns.length };
            current.tools = m;
            turns.push(current);
            current = null;
            continue;
          }
          if (m.role === 'user') {
            if (current && (current.user || current.assistant || current.tools)) {
              turns.push(current);
              current = null;
            }
            current = { index: turns.length, user: m };
            continue;
          }
          if (m.role === 'assistant') {
            if (!current) current = { index: turns.length };
            current.assistant = m;
            continue;
          }
        }
        if (current && (current.user || current.assistant || current.tools)) turns.push(current);
      }
    } else {
      // Sequential bundling
      let current: Turn | null = null;
      for (const m of nonSystem) {
        if (isToolMsg(m)) {
          if (!current) current = { index: turns.length };
          current.tools = m;
          turns.push(current);
          current = null;
          continue;
        }
        if (m.role === 'user') {
          if (current && (current.user || current.assistant || current.tools)) {
            turns.push(current);
            current = null;
          }
          current = { index: turns.length, user: m };
          continue;
        }
        if (m.role === 'assistant') {
          if (!current) current = { index: turns.length };
          current.assistant = m;
          continue;
        }
      }
      if (current && (current.user || current.assistant || current.tools)) turns.push(current);
    }

    return { systemMsgs, turns } as { systemMsgs: AgentRunMessage[]; turns: { index: number; turnNumber?: number; user?: AgentRunMessage; assistant?: AgentRunMessage; tools?: AgentRunMessage }[] };
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

export function AgentFeatureRunView({ log }: { log : AgentFeatureRunLog })
{
  const messages = log.messages

  return (
    {messages.length === 0 ? (
      <div className="text-sm text-neutral-500">No conversation yet.</div>
    ) : (
      <ul className="space-y-3">
        {messages.entries(({ role, content }, index) => {
          const isAssistant = role == "assistant"

          if (isAssistant){
            const message = JSON.parse(content) as AgentResponse
          }else{
            if (index == 0){ //first message is always an initial text prompt
              const message : string = content
            }else{
              const toolResult = JSON.parse(content) as ToolResult[]
            }
          }

          //TODO: map the new data

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
                        <ToolCallRow key={i} call={call} index={i} resultText={pickResultForCall(call, i)} />
                      ))}
                    </div>
                  ) : null}

                  {toolCalls.length === 0 && resultsObjs.length > 0 ? (
                    <div className="rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 p-2">
                      <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">Tool results</div>
                      {resultsObjs.map((r, i) => (
                        <div key={i} className="rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-2 mb-2 last:mb-0 text-xs whitespace-pre-wrap break-words max-h-60 overflow-auto">
                          <SafeText text={r.result} />
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
  )
}

export default function ChatConversation({ run }: { run: AgentRun }) {
  const lastFeatureRef = useRef<HTMLLIElement | null>(null);

  const logs = useMemo(() => {
    return Object.values(run.messagesLog ?? {}).sort((a,b) => a.startDate.getTime() - b.startDate.getTime())
  }, [run]);

  return (
    <div className="h=[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3">
      {logs.map(log => (
        <AgentFeatureRunView key={log.featureId} log={log} />
      ))}
    </div>
  );
}
