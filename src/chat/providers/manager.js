import { OpenAIProvider } from './openai.js';
import { LiteLLMProvider } from './litellm.js';
import { LMStudioProvider } from './lmstudio.js';

export function getProvider(config) {
  if (config.provider === 'litellm') {
    return new LiteLLMProvider(config);
  }else if (config.provider === 'lmstudio') {
    return new LMStudioProvider(config);
  }
    return new OpenAIProvider(config);
}
