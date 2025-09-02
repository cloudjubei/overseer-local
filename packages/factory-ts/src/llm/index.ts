export type LLMConfig = {
  provider?: string;
  model?: string;
  apiKeyEnv?: string;
  temperature?: number;
  maxTokens?: number;
};

export type RunBudget = { usd?: number };

export type AgentMetadata = Record<string, unknown>;

export type AgentStartParams = {
  projectId: string;
  taskId?: string | number;
  featureId?: string | number;
  llmConfig?: LLMConfig;
  budgetUSD?: number;
  metadata?: AgentMetadata;
};
