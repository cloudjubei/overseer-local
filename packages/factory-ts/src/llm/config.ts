import { ChatMessage } from './types';

export type LLMProvider = 'openai' | 'azure-openai' | 'anthropic' | 'other';

export interface BaseLLMConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface OpenAIConfig extends BaseLLMConfig {
  provider: 'openai';
  apiKey?: string; // If omitted, read from process.env.OPENAI_API_KEY
  baseURL?: string; // Custom base URL for proxies
  organization?: string;
  // extra options bag
  extra?: Record<string, unknown>;
}

export type OverseerLLMConfig = OpenAIConfig; // Extend with more providers as they are added

export interface ChatPrompt {
  messages: ChatMessage[];
}

export function normalizeConfig(config: OverseerLLMConfig): OverseerLLMConfig {
  return config;
}
