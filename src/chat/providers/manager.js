import { OpenAIProvider } from './openai.js';
import { LiteLLMProvider } from './litellm.js';

export function getProvider(config) {
  if (config.provider === 'openai') {
    return new OpenAIProvider(config);
  } else {
    return new LiteLLMProvider(config);
  }
}
