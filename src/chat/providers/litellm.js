import { BaseProvider } from './base';
import { OpenAI } from 'openai';
import { completion as liteCompletion } from 'litellm';

// The LiteLLM provider supports two modes:
// 1) Proxy mode (recommended): when config.apiBaseUrl is set to a LiteLLM proxy URL,
//    we use OpenAI-compatible REST via the OpenAI SDK to reach any model (grok, claude, gemini, etc.).
// 2) Direct SDK fallback: when no apiBaseUrl is provided, we call litellm.completion().
//    This requires provider-specific API keys to be present in process.env, which is often
//    not practical in this app. Proxy mode is preferred to avoid "model not supported" errors.
export class LiteLLMProvider extends BaseProvider {
  constructor(config) {
    super(config);
    // If a LiteLLM proxy base URL is provided, use OpenAI-compatible API via SDK
    if (config.apiBaseUrl) {
      this.client = new OpenAI({
        baseURL: config.apiBaseUrl,
        apiKey: config.apiKey,
        timeout: config.timeout,
      });
    } else {
      this.client = null;
    }
  }

  async createCompletion(params) {
    // Prefer proxy mode when available
    if (this.client) {
      return this.client.chat.completions.create(params);
    }

    // Fallback to litellm's direct SDK call. This likely needs provider-specific env vars
    // (e.g., ANTHROPIC_API_KEY, GEMINI_API_KEY). Provide better parameter compatibility.
    try {
      const result = await liteCompletion({
        model: params.model,
        messages: params.messages,
        // Prefer proxy mode: but if user passed apiBaseUrl anyway, pass through
        api_base: this.config.apiBaseUrl,
        apiKey: this.config.apiKey, // for older versions
        api_key: this.config.apiKey, // for newer versions
        timeout: this.config.timeout ? Math.ceil(this.config.timeout / 1000) : undefined,
        // Tools (functions) should be transparently forwarded in latest litellm
        tools: params.tools,
        tool_choice: params.tool_choice,
        stream: false,
      });
      // Normalize to OpenAI Chat Completions-like shape if needed
      return result;
    } catch (error) {
      // Provide a clearer instruction for common pitfalls
      const hint = `LiteLLM direct SDK could not route model \"${params.model}\". ` +
        `Consider configuring a LiteLLM proxy (set apiBaseUrl, e.g., http://localhost:4000) ` +
        `or ensure provider-specific API keys (e.g., ANTHROPIC_API_KEY, GEMINI_API_KEY) are set.`;
      const err = new Error(`${error?.message || String(error)}\n${hint}`);
      err.cause = error;
      throw err;
    }
  }

  async listModels() {
    // When using a LiteLLM proxy, try listing models via OpenAI-compatible endpoint
    if (this.client) {
      try {
        const res = await this.client.models.list();
        if (!res || !Array.isArray(res.data)) return [];
        return res.data.map((m) => m.id);
      } catch (err) {
        return [];
      }
    }
    // No proxy -> cannot reliably list models
    return [];
  }
}
