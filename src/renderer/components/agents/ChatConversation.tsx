import React, { useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import type { AgentFeatureRunLog, AgentRun, AgentRunMessage } from '../../services/agentsService';
import RichText from '../ui/RichText';
import SafeText from '../ui/SafeText';
import { ToolResult, AgentResponse, ToolCall } from 'thefactory-tools';

// Parse assistant JSON response to extract thoughts and tool calls safely
function parseAssistant(content: string): AgentResponse | null {
  try {
    const obj = JSON.parse(content);
    if (obj && typeof obj === 'object') return obj as AgentResponse;
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

function Collapsible({ title, children, defaultOpen = false, className, innerClassName }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean, className?: string, innerClassName?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${className ??''} border rounded-md border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900`}>
      <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50" onClick={() => setOpen(v => !v)}>
        <span className="text-xs font-medium truncate pr-2">{title}</span>
        <span className="text-xs text-neutral-500">{open ? '\u2212' : '+'}</span>
      </button>
      {open ? (
        <div className={`${innerClassName ??''} border-t border-neutral-200 dark:border-neutral-800`}>{children}</div>
      ) : null}
    </div>
  );
}

function ToolCallRow({ call, resultText, index }: { call: ToolCall; resultText?: string; index: number }) {
  const name = (call as any).tool_name || (call as any).tool || (call as any).name || 'tool';
  const args = (call as any).arguments ?? (call as any).parameters ?? {};
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
      if (Array.isArray(jo)) {
        for (const x of jo) {
          if (x && typeof x === 'object' && 'name' in x && 'result' in x) {
            out.push({ name: String((x as any).name), result: String((x as any).result) });
          }
        }
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

function isToolMsg(m: AgentRunMessage | undefined) {
  if (!m) return false;
  const content = m.content || '';
  const hinted = (m as any).source === 'tools';
  if (m.role === 'tool' || hinted || content.startsWith('--- TOOL RESULTS ---')) return true;
  // Robust detection: if content is JSON representing tool results, treat as tool message
  try {
    const o = JSON.parse(content);
    if (Array.isArray(o)) {
      return o.every(x => x && typeof x === 'object' && 'name' in x && 'result' in x);
    }
    if (o && typeof o === 'object') {
      if ('name' in o && 'result' in o) return true;
      if ('results' in o && Array.isArray((o as any).results)) {
        return (o as any).results.every((x: any) => x && typeof x === 'object' && 'name' in x && 'result' in x);
      }
    }
  } catch {}
  return false;
}

function buildFeatureTurns(messages: AgentRunMessage[]) {
  const turns: { assistant: AgentRunMessage; tools?: AgentRunMessage; index: number; isFinal?: boolean; thinkingTime?: number }[] = [];
  if (!messages || messages.length === 0) return { initial: undefined as AgentRunMessage | undefined, turns };

  // Initial message is the first non-tool message (usually user)
  let idx = 0;
  while (idx < messages.length && isToolMsg(messages[idx])) idx++;
  const initial = messages[idx];
  idx++;

  let tIndex = 0;
  while (idx < messages.length) {
    const a = messages[idx];
    if (!a) break;
    if (a.role !== 'assistant') {
      // Skip anything unexpected
      idx++;
      continue;
    }

    let thinkingTime: number | undefined;
    try {
      const askedAt = a.askedAt ? new Date(a.askedAt).getTime() : NaN;
      const createdAt = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      if (!isNaN(askedAt) && !isNaN(createdAt)) {
        thinkingTime = Math.max(0, createdAt - askedAt);
      }
    } catch {}

    const parsed = parseAssistant(a.content);
    if (parsed && Array.isArray(parsed.tool_calls) && parsed.tool_calls.length > 0) {
      const maybeTools = messages[idx + 1];
      if (isToolMsg(maybeTools)) {
        turns.push({ assistant: a, tools: maybeTools, index: tIndex++, thinkingTime });
        idx += 2;
        continue;
      }
      // No tools message, still push assistant-only
      turns.push({ assistant: a, index: tIndex++, thinkingTime });
      idx += 1;
      continue;
    }
    // Final assistant message (no tool_calls)
    turns.push({ assistant: a, index: tIndex++, isFinal: true, thinkingTime });
    idx += 1;
  }
  return { initial, turns };
}

function AssistantBubble({ title, text }: { title?: string; text: string }) {
  return (
    <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-100 shadow-sm">
      {title ? <div className="text-[11px] font-medium mb-1">{title}</div> : null}
      {isLargeText(text) ? (
        <ScrollableTextBox text={text} />
      ) : (
        <div className="text-xs whitespace-pre-wrap break-words"><RichText text={text} /></div>
      )}
    </div>
  );
}

function UserBubble({ title, text }: { title?: string; text: string }) {
  return (
    <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50 shadow-sm">
      {title ? <div className="text-[11px] font-medium mb-1">{title}</div> : null}
      {isLargeText(text) ? (
        <ScrollableTextBox text={text} />
      ) : (
        <div className="text-xs whitespace-pre-wrap break-words"><RichText text={text} /></div>
      )}
    </div>
  );
}

function FeatureContent({ log, isLatestFeature, latestTurnRef }: { log: AgentFeatureRunLog; isLatestFeature: boolean; latestTurnRef?: React.RefObject<HTMLDivElement> }) {
  // Recompute on every render to reflect in-place mutations of log.messages
  const { initial, turns } = buildFeatureTurns(log.messages || []);

  return (
    <div className="space-y-2 p-1">
      {initial ? (
        <Collapsible title={<span className="flex items-center1">Initial prompt</span>} defaultOpen={false}>
          {isLargeText(initial.content || '') ? (
            <ScrollableTextBox text={initial.content || ''} />
          ) : (
            <div className="p-2 text-xs whitespace-pre-wrap break-words"><RichText text={initial.content || ''} /></div>
          )}
        </Collapsible>
      ) : (
        <div className="text-sm text-neutral-500">No conversation yet.</div>
      )}

      {turns.map((t, idx) => {
        const parsed = parseAssistant(t.assistant?.content || '');
        const toolCalls: ToolCall[] = parsed?.tool_calls || [];
        const resultsObjs = parseToolResultsObjects(t.tools);
        const pickResultForCall = (call: ToolCall, i: number) => resultsObjs[i]?.result ?? undefined;
        const hasThoughts = parsed?.thoughts && parsed.thoughts.trim().length > 0;
        const isFinal = t.isFinal || (toolCalls.length === 0);

        const isLatestTurn = idx === turns.length - 1;
        const defaultOpen = isLatestFeature && isLatestTurn;

        return (
          <div key={idx} ref={defaultOpen && latestTurnRef ? latestTurnRef : undefined}>
            <Collapsible innerClassName='p-2' title={<span className="flex items-center gap-2">{isFinal ? 'Final' : `Turn ${idx + 1}`}</span>} defaultOpen={defaultOpen}>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {hasThoughts ? (
                      <AssistantBubble text={parsed!.thoughts!} />
                    ) : (
                      <AssistantBubble title="Assistant" text={t.assistant?.content || ''} />
                    )}
                  </div>
                  {t.thinkingTime != null && (
                    <div className="flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 rounded-full px-2 py-0.5 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap mt-1">
                      {(t.thinkingTime / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>

                {toolCalls.length > 0 ? (
                  <div className="space-y-2">
                    {toolCalls.map((call, i) => (
                      <ToolCallRow key={i} call={call} index={i} resultText={pickResultForCall(call, i)} />
                    ))}
                  </div>
                ) : null}

                {toolCalls.length === 0 && !isFinal && resultsObjs.length > 0 ? (
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
          </div>
        );
      })}
    </div>
  );
}

export default function ChatConversation({ run }: { run: AgentRun }) {
  // Derive logs (sorted by startDate). Recompute each render to reflect in-place mutations.
  const SKIP_FEATURE_KEYS = new Set(['__task__', '_task']);
  const logs = Object.values(run.messagesLog ?? {})
    .filter((l) => !SKIP_FEATURE_KEYS.has((l as any).featureId))
    .sort((a, b) => {
      const at = new Date((a as any).startDate).getTime();
      const bt = new Date((b as any).startDate).getTime();
      return at - bt;
    });

  const latestFeature = logs.length > 0 ? logs[logs.length - 1] : undefined;
  const latestFeatureId = latestFeature?.featureId;

  // Track a scroll container and auto-scroll behavior
  const containerRef = useRef<HTMLUListElement | null>(null);
  const stickToBottomRef = useRef(true);
  const latestTurnRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);

  // Update stickToBottomRef on user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 40; // px
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
      stickToBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    // Initialize state
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Compute a simple metric to detect new content
  const contentSize = useMemo(() => {
    let count = 0;
    for (const l of logs) count += (l.messages?.length || 0);
    return count + ':' + logs.length;
  }, [logs]);

  // Auto-scroll when new content arrives and user is at bottom
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [contentSize]);

  // One-time scroll to the latest feature's latest turn on initial content render
  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    const target = latestTurnRef.current;
    if (target) {
      try {
        target.scrollIntoView({ block: 'nearest' });
        didInitialScrollRef.current = true;
      } catch {}
    }
  }, [contentSize]);

  return (
    <ul ref={containerRef} className="h-[60vh] max-h-[70vh] overflow-auto bg-neutral-50 dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-800 p-3 space-y-3" role="log" aria-live="polite">
      {logs.length === 0 ? (
        <div className="text-sm text-neutral-500">No features messages to display.</div>
      ) : (
        <>{logs.map((log) => {
          const start = log.startDate ? new Date(log.startDate as any) : undefined;
          const end = log.endDate ? new Date(log.endDate as any) : undefined;
          const subtitle = [start ? start.toLocaleString() : null, end ? `→ ${end.toLocaleString()}` : null].filter(Boolean).join(' ');
          const isLatestFeature = log.featureId === latestFeatureId;
          return (
            <li key={log.featureId}>
              <Collapsible title={<span className="flex items-center">Feature: {log.featureId}{subtitle ? <span className="text-neutral-500 text-[11px] px-3 py-2"> {subtitle}</span> : null}</span>} defaultOpen={isLatestFeature}>
                <FeatureContent log={log} isLatestFeature={isLatestFeature} latestTurnRef={isLatestFeature ? latestTurnRef : undefined} />
              </Collapsible>
            </li>
          );
        })}</>
      )}
    </ul>
  );
}
