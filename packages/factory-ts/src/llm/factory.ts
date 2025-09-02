import { LLMClient } from './types';
import { OverseerLLMConfig } from './config';
import { createOpenAIClient } from './openaiClient';

export type LLMClientOrConfig = LLMClient | OverseerLLMConfig;

export async function makeLLMClient(configOrClient: LLMClientOrConfig): Promise<LLMClient> {
  // If already a client (duck typing), return it directly (dependency injection)
  if (typeof (configOrClient as any)?.chatCompletionOnce === 'function' && typeof (configOrClient as any)?.chatCompletionStream === 'function') {
    return configOrClient as LLMClient;
  }

  const config = configOrClient as OverseerLLMConfig;
  switch (config.provider) {
    case 'openai': {
      return createOpenAIClient(config.model, {
        apiKey: (config as any).apiKey,
        baseURL: (config as any).baseURL,
        organization: (config as any).organization,
      });
    }
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
