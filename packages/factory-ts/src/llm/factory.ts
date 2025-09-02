import { LLMClient } from './types';
import { OverseerLLMConfig } from './config';
import { createOpenAIClient } from './openaiClient';
import { logger } from '../utils/logger';

export type LLMClientOrConfig = LLMClient | OverseerLLMConfig;

export async function makeLLMClient(configOrClient: LLMClientOrConfig): Promise<LLMClient> {
  // If already a client (duck typing), return it directly (dependency injection)
  if (typeof (configOrClient as any)?.chatCompletionOnce === 'function' && typeof (configOrClient as any)?.chatCompletionStream === 'function') {
    logger.info('makeLLMClient(): using provided client instance');
    return configOrClient as LLMClient;
  }

  const config = configOrClient as OverseerLLMConfig;
  logger.info('makeLLMClient(): creating client', { provider: config.provider, model: (config as any)?.model });
  switch (config.provider) {
    case 'openai': {
      const client = createOpenAIClient(config.model, {
        apiKey: (config as any).apiKey,
        baseURL: (config as any).baseURL,
        organization: (config as any).organization,
      });
      logger.debug('makeLLMClient(): OpenAI client created');
      return client;
    }
    default:
      logger.error('makeLLMClient(): unsupported provider', config.provider);
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
