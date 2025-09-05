export type Status = '+' | '-' | '~' | '?' | '=';
export interface Feature {
  id: string;
  status: Status;
  title: string;
  description: string;
  context: string[];
  plan?: string;
  acceptance?: string[];
  blockers?: string[];
  rejection?: string;
}
export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  features: Feature[];
  featureIdToDisplayIndex: Record<string, number>;
  blockers?: string[];
  rejection?: string;
}
export interface ProjectRequirement {
  id: number;
  status: Status;
  description: string;
  tasks: string[];
}
export interface ProjectSpec {
  id: string;
  title: string;
  description: string;
  path: string;
  repo_url: string;
  requirements: ProjectRequirement[];
  taskIdToDisplayIndex: Record<string, number>;
  metadata?: Record<string,any>;
}
export type CompletionMessageRole = 'system' | 'user' | 'assistant';
export type CompletionMessage = { role: CompletionMessageRole; content: string };
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
export type ToolResult = { name: string; result: string };
export type AgentResponse = { thoughts?: string; tool_calls?: ToolCall[] };

export type LLMConfig = {
  model: string;
  provider: string; // e.g., openai, azure, together, groq, openrouter, ollama, custom
  apiKey: string;
  apiBaseUrl: string;

  // extra provider fields (azure etc.) tolerated
  [key: string]: any;
};


export type AgentType = 'developer' | 'tester' | 'planner' | 'contexter' | 'speccer';
export type AgentRun = {
  agent: AgentType;
  projectId: string;
  taskId: string;
  featureId?: string;
  llmConfig: LLMConfig;
  options?: {
    budgetUSD?: number;
    metadata?: Record<string, any>;
  }
};
export type RunEvent = { type: string; payload?: any };