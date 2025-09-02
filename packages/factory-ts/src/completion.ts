import fetch from 'node-fetch';
import { CompletionClient, CompletionMessage } from './types.js';

export type ProviderKind = 'openai' | 'azure' | 'together' | 'groq' | 'ollama' | 'openrouter' | 'custom';

export interface CompletionConfig {
  provider?: ProviderKind;
  apiKey?: string;
  baseURL?: string; // override base URL for OpenAI-compatible servers
  organization?: string;
  azure?: {
    endpoint?: string; // e.g., https://<resource>.openai.azure.com
    deployment?: string; // model deployment name
    apiVersion?: string; // e.g., 2024-06-01
    apiKey?: string; // override apiKey per-azure
  };
  headers?: Record<string, string>;
  // Optional response control flags
  temperature?: number;
  maxTokens?: number;
}

function env(key: string): string | undefined {
  try { return process.env[key]; } catch { return undefined; }
}

function resolveConfig(partial?: CompletionConfig): Required<CompletionConfig> & { provider: ProviderKind } {
  const provider = partial?.provider || (env('FACTORY_PROVIDER') as ProviderKind) || 'openai';

  // Defaults for common providers
  let baseURL = partial?.baseURL || env('OPENAI_BASE_URL') || '';
  let apiKey = partial?.apiKey || env('OPENAI_API_KEY') || '';
  const headers: Record<string, string> = { ...(partial?.headers || {}) };

  if (provider === 'openai') {
    baseURL ||= 'https://api.openai.com/v1';
    apiKey ||= env('OPENAI_API_KEY') || '';
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'openrouter') {
    baseURL ||= 'https://openrouter.ai/api/v1';
    apiKey ||= env('OPENROUTER_API_KEY') || '';
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'together') {
    baseURL ||= 'https://api.together.xyz/v1';
    apiKey ||= env('TOGETHER_API_KEY') || '';
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'groq') {
    baseURL ||= 'https://api.groq.com/openai/v1';
    apiKey ||= env('GROQ_API_KEY') || '';
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'ollama') {
    baseURL ||= env('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434/v1';
    // no api key by default
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  } else if (provider === 'azure') {
    const endpoint = partial?.azure?.endpoint || env('AZURE_OPENAI_ENDPOINT') || '';
    const apiVersion = partial?.azure?.apiVersion || env('AZURE_OPENAI_API_VERSION') || '2024-06-01';
    const deployment = partial?.azure?.deployment || env('AZURE_OPENAI_DEPLOYMENT') || '';
    const azKey = partial?.azure?.apiKey || env('AZURE_OPENAI_KEY') || partial?.apiKey || env('OPENAI_API_KEY') || '';
    // Azure uses a special path per deployment
    baseURL = `${endpoint}/openai/deployments/${deployment}`.replace(/\/+$/,'');
    apiKey = azKey;
    if (apiKey) headers['api-key'] = apiKey;
    // We'll append parameters in request path
    (partial as any).azure = { endpoint, deployment, apiVersion, apiKey: azKey };
  } else if (provider === 'custom') {
    baseURL ||= env('FACTORY_COMPLETION_BASE_URL') || 'http://localhost:8000/v1';
    apiKey ||= env('FACTORY_COMPLETION_API_KEY') || '';
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const temperature = partial?.temperature ?? Number(env('FACTORY_TEMPERATURE') || 0);
  const maxTokens = partial?.maxTokens ?? (env('FACTORY_MAX_TOKENS') ? Number(env('FACTORY_MAX_TOKENS')) : undefined);

  return {
    provider,
    apiKey,
    baseURL,
    organization: partial?.organization || env('OPENAI_ORG') || '',
    azure: partial?.azure || {},
    headers,
    temperature,
    maxTokens,
  } as any;
}

function mapMessages(messages: CompletionMessage[]) {
  return messages.map(m => ({ role: m.role, content: m.content }));
}

async function openAICompatibleChat(baseURL: string, headers: Record<string,string>, body: any): Promise<string> {
  const url = baseURL.replace(/\/+$/,'') + '/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>'');
    throw new Error(`Completion HTTP ${res.status}: ${txt}`);
  }
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? data?.message?.content;
  if (typeof content !== 'string') throw new Error('Invalid completion response');
  return content;
}

function createAzureBody(model: string, messages: any[], temperature: number, maxTokens?: number) {
  const body: any = { model, messages, temperature };
  if (maxTokens !== undefined) body.max_tokens = maxTokens;
  return body;
}

export function createCompletionClient(config?: CompletionConfig): CompletionClient {
  const cfg = resolveConfig(config);

  const client: CompletionClient = async ({ model, messages, response_format }) => {
    const mapped = mapMessages(messages);
    const wantsJson = response_format?.type === 'json_object';

    // Common OpenAI-compatible body
    const baseBody: any = {
      model,
      messages: mapped,
      temperature: cfg.temperature,
    };
    if (cfg.maxTokens !== undefined) baseBody.max_tokens = cfg.maxTokens;
    if (wantsJson) baseBody.response_format = { type: 'json_object' };

    let content: string;

    if (cfg.provider === 'azure') {
      const az = cfg.azure as any;
      const url = `${cfg.baseURL.replace(/\/+$/,'')}/chat/completions?api-version=${encodeURIComponent(az.apiVersion || '2024-06-01')}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(cfg.headers || {}) },
        body: JSON.stringify(createAzureBody(model, mapped, cfg.temperature, cfg.maxTokens)),
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(`Azure Completion HTTP ${res.status}: ${txt}`);
      }
      const data: any = await res.json();
      content = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Invalid Azure completion response');
    } else {
      // OpenAI-compatible providers
      content = await openAICompatibleChat(cfg.baseURL, cfg.headers || {}, baseBody);
    }

    return { message: { content } };
  };

  return client;
}

// Simple mock client that just echoes a minimal valid JSON to drive tool loop
export function createMockCompletionClient(script?: (history: CompletionMessage[]) => string): CompletionClient {
  return async ({ messages }) => {
    const content = script ? script(messages) : JSON.stringify({ thoughts: 'mock', tool_calls: [] });
    return { message: { content } };
  };
}
