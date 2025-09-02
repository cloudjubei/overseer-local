import { ChatCompletionInput, ChatCompletionResult, ChatStream, LLMClient, StreamEvent, TokenUsage, UsageAccumulator, estimateTokensFromText } from './types';
import { OPENAI_MODEL_COSTS } from './costs';

export interface OpenAIAdapterOptions {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
}

// Dynamic import helper to avoid hard dependency unless needed
async function loadOpenAI() {
  try {
    const mod: any = await import('openai');
    const OpenAI = mod.default ?? mod.OpenAI ?? mod;
    return OpenAI;
  } catch (err) {
    throw new Error(
      "The 'openai' package is required for OpenAI provider. Please install it as a peer dependency (npm i openai)."
    );
  }
}

export class OpenAILLMClient implements LLMClient {
  readonly provider = 'openai';
  readonly model: string;
  private client: any; // OpenAI client instance
  private usageAcc: UsageAccumulator;

  constructor(model: string, client: any) {
    this.model = model;
    this.client = client;
    this.usageAcc = new UsageAccumulator(model, OPENAI_MODEL_COSTS);
  }

  async chatCompletionOnce(input: Omit<ChatCompletionInput, 'model'>): Promise<ChatCompletionResult> {
    // Prefer Chat Completions API for broad model compatibility
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      stream: false,
      ...(input.extra ?? {}),
    });

    const text = res.choices?.[0]?.message?.content ?? '';
    const usage = res.usage
      ? ({
          promptTokens: res.usage.prompt_tokens ?? 0,
          completionTokens: res.usage.completion_tokens ?? 0,
          totalTokens: res.usage.total_tokens ?? ((res.usage.prompt_tokens ?? 0) + (res.usage.completion_tokens ?? 0)),
          isEstimated: false,
        } as TokenUsage)
      : null;

    let resultUsage = null;
    if (usage) {
      this.usageAcc.add(usage);
      const cost = {
        inputCostPer1K: OPENAI_MODEL_COSTS[this.model]?.inputCostPer1K ?? null,
        outputCostPer1K: OPENAI_MODEL_COSTS[this.model]?.outputCostPer1K ?? null,
        totalCostUSD:
          OPENAI_MODEL_COSTS[this.model]
            ? (usage.promptTokens / 1000) * (OPENAI_MODEL_COSTS[this.model].inputCostPer1K ?? 0) +
              (usage.completionTokens / 1000) * (OPENAI_MODEL_COSTS[this.model].outputCostPer1K ?? 0)
            : null,
      };
      resultUsage = { ...usage, cost };
    }

    return { text, usage: resultUsage, raw: res };
  }

  async chatCompletionStream(input: Omit<ChatCompletionInput, 'model'>): Promise<ChatStream> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: input.messages.map((m: any) => ({ role: m.role, content: m.content })),
      temperature: input.temperature,
      max_tokens: input.maxTokens,
      stream: true,
      ...(input.extra ?? {}),
    });

    let accumulated = '';

    const asyncIterable: AsyncIterable<StreamEvent> = {
      [Symbol.asyncIterator]() {
        const iterator = stream[Symbol.asyncIterator]();
        return {
          async next() {
            const { value, done } = await iterator.next();
            if (done) return { done: true, value: undefined } as any;
            const delta = value?.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              accumulated += delta;
              return { done: false, value: { type: 'delta', content: delta } satisfies StreamEvent } as any;
            }
            return { done: false, value: { type: 'delta', content: '' } satisfies StreamEvent } as any;
          },
        };
      },
    };

    const final = (async (): Promise<ChatCompletionResult> => {
      try {
        // Consume to completion to ensure stream ends
        for await (const _ of stream) {
          // already processed in iterator above; this ensures the underlying stream completes
        }
      } catch (e) {
        return { text: accumulated, usage: null, raw: e };
      }
      // Usage isn't provided reliably in streaming responses; estimate based on content length
      const estimatedCompletionTokens = estimateTokensFromText(accumulated);
      // For prompt tokens estimation, use sum of prompt messages content
      const promptText = input.messages.map((m) => m.content).join('\n');
      const estimatedPromptTokens = estimateTokensFromText(promptText);
      const usage: TokenUsage = {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
        isEstimated: true,
      };
      this.usageAcc.add(usage);

      const cost = OPENAI_MODEL_COSTS[this.model]
        ? {
            inputCostPer1K: OPENAI_MODEL_COSTS[this.model].inputCostPer1K,
            outputCostPer1K: OPENAI_MODEL_COSTS[this.model].outputCostPer1K,
            totalCostUSD:
              (estimatedPromptTokens / 1000) * (OPENAI_MODEL_COSTS[this.model].inputCostPer1K ?? 0) +
              (estimatedCompletionTokens / 1000) * (OPENAI_MODEL_COSTS[this.model].outputCostPer1K ?? 0),
          }
        : { inputCostPer1K: null, outputCostPer1K: null, totalCostUSD: null };

      return { text: accumulated, usage: { ...usage, cost } };
    })();

    return { stream: asyncIterable, final };
  }

  getUsage() {
    return this.usageAcc.snapshot();
  }
}

export async function createOpenAIClient(model: string, opts: OpenAIAdapterOptions = {}): Promise<OpenAILLMClient> {
  const OpenAI = await loadOpenAI();
  const apiKey = opts.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is required: set opts.apiKey or OPENAI_API_KEY');
  }
  const client = new OpenAI({ apiKey, baseURL: opts.baseURL, organization: opts.organization });
  return new OpenAILLMClient(model, client);
}
