export type Status = '+' | '-' | '~' | '?';
export interface Feature {
  id: string;
  status: Status;
  title: string;
  description: string;
  plan?: string;
  context?: string[];
  acceptance?: string[];
  dependencies?: string[];
  rejection?: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status?: Status;
  rejection?: string;
  features: Feature[];
  featureIdToDisplayIndex?: Record<string, number>;
}
export type CompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type CompletionResponse = { message: { role: 'assistant'; content: string } };
export type CompletionClient = (req: { model: string; messages: CompletionMessage[]; response_format?: any }) => Promise<CompletionResponse>;
export type ToolCall = { tool_name?: string; tool?: string; name?: string; arguments?: any; parameters?: any };
export type AgentResponse = { thoughts?: string; tool_calls?: ToolCall[] };
export type GitManager = import('./git/gitManager.js').default;
export type TaskUtils = import('./taskUtils.js').TaskUtils;
