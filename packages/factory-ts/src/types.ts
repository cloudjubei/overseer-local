export type Status = '+' | '-' | '~' | '?' | '=';
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
  dependencies?: string[];
}
export interface ProjectRequirement {
  id: number;
  status: Status;
  description: string;
  tasks: number[];
}
export interface ProjectSpec {
  id: string;
  title: string;
  description: string;
  path: string;
  repo_url: string;
  requirements: ProjectRequirement[];
  taskIdToDisplayIndex: Record<string, number>;
}
export type CompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type CompletionUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUSD?: number;
  provider?: string;
  model?: string;
};
export type CompletionResponse = { message: { role: 'assistant'; content: string }; usage?: CompletionUsage };
export type CompletionClient = (req: { model: string; messages: CompletionMessage[]; response_format?: any }) => Promise<CompletionResponse>;
export type ToolCall = { tool_name?: string; tool?: string; name?: string; arguments?: any; parameters?: any };
export type AgentResponse = { thoughts?: string; tool_calls?: ToolCall[] };
