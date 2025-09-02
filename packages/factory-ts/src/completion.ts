import fetch from 'node-fetch';

export type CompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string };
export type CompletionResponse = { message: { role: 'assistant'; content: string }, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number; costUSD?: number; provider?: string; model?: string } };
export type CompletionClient = (req: { model: string; messages: CompletionMessage[]; response_format?: any }) => Promise<CompletionResponse>;

export function createCompletionClient(cfg: { model: string; provider?: string; apiKey?: string; baseURL?: string; [k: string]: any }): CompletionClient {
  // Simple OpenAI-compatible client; supports custom baseURL
  const baseURL = cfg.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = cfg.apiKey || process.env.OPENAI_API_KEY || '';
  const provider = cfg.provider || 'openai';

  // Mock mode if no apiKey
  if (!apiKey && process.env.FACTORY_MOCK_LLM === '1') {
    return async ({ messages, model }) => {
      const last = messages[messages.length - 1]?.content || '{}';
      const content = typeof last === 'string' && last.includes('tool_calls') ? last : '{"thoughts":"mock","tool_calls":[]}';
      return { message: { role: 'assistant', content }, usage: { provider, model } };
    };
  }

  // OpenAI Chat Completions API compatible
  return async ({ model, messages, response_format }) => {
    const url = `${baseURL.replace(/\/$/, '')}/chat/completions`;
    const body = { model, messages, response_format };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': provider === 'openai' ? `Bearer ${apiKey}` : `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`LLM request failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const msg = data.choices?.[0]?.message || { role: 'assistant', content: '{}' };
    const usageRaw = data.usage || {};
    const usage = {
      promptTokens: usageRaw.prompt_tokens,
      completionTokens: usageRaw.completion_tokens,
      totalTokens: usageRaw.total_tokens,
      provider,
      model,
    };
    return { message: msg, usage };
  };
}
