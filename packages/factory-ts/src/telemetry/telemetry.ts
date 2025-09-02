import { EventBus, RunBudget, RunEvent, TelemetrySnapshot } from '../events/types'
import { ModelPricingProvider } from '../llm/types'
import { roundUsd, tokensToUsd } from '../llm/costs'

export interface TelemetryOptions {
  runId: string
  bus: EventBus<RunEvent>
  pricing: ModelPricingProvider
  budget?: RunBudget
  abortController?: AbortController
}

interface ModelTotals {
  requests: number
  promptTokens: number
  completionTokens: number
  costUsd: number
}

interface RequestState {
  model: string
  promptTokens: number
  completionTokensStreamed: number
  startedAt: number
}

export class Telemetry {
  private runId: string
  private bus: EventBus<RunEvent>
  private pricing: ModelPricingProvider
  private budget?: RunBudget
  private controller?: AbortController

  private startedAt: number
  private updatedAt: number

  private totalRequests = 0
  private totalPromptTokens = 0
  private totalCompletionTokens = 0
  private costUsd = 0
  private perModel: Record<string, ModelTotals> = {}

  private status: 'running' | 'stopped' = 'running'
  private stopReason?: string

  private requests = new Map<string, RequestState>()

  constructor(opts: TelemetryOptions) {
    this.runId = opts.runId
    this.bus = opts.bus
    this.pricing = opts.pricing
    this.budget = opts.budget
    this.controller = opts.abortController
    const now = Date.now()
    this.startedAt = now
    this.updatedAt = now
  }

  snapshot(): TelemetrySnapshot {
    return {
      startedAt: this.startedAt,
      updatedAt: this.updatedAt,
      totalRequests: this.totalRequests,
      totalPromptTokens: this.totalPromptTokens,
      totalCompletionTokens: this.totalCompletionTokens,
      totalTokens: this.totalPromptTokens + this.totalCompletionTokens,
      costUsd: roundUsd(this.costUsd),
      perModel: this.perModel,
      status: this.status,
      stopReason: this.stopReason,
      budget: this.budget
    }
  }

  requestStarted(requestId: string, model: string) {
    this.requests.set(requestId, {
      model,
      promptTokens: 0,
      completionTokensStreamed: 0,
      startedAt: Date.now()
    })
    this.bus.emit({ type: 'llm/request/started', runId: this.runId, at: Date.now(), requestId, model })
  }

  streamDelta(requestId: string, deltaTokensOut: number) {
    const req = this.requests.get(requestId)
    if (!req) return
    if (deltaTokensOut <= 0) return
    req.completionTokensStreamed += deltaTokensOut

    // cost for streamed output tokens
    const p = this.pricing.getPricing(req.model)
    if (p) {
      this.costUsd += tokensToUsd(deltaTokensOut, p.outputPer1K)
    }

    this.totalCompletionTokens += deltaTokensOut
    this.totalRequests = Math.max(this.totalRequests, this.requests.size)
    const mt = (this.perModel[req.model] ||= { requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    mt.completionTokens += deltaTokensOut
    if (p) {
      mt.costUsd += tokensToUsd(deltaTokensOut, p.outputPer1K)
    }

    this.touch()
    this.bus.emit({ type: 'llm/request/stream', runId: this.runId, at: Date.now(), requestId, model: req.model, deltaTokensOut })
    this.emitUpdate()
    this.checkBudget()
  }

  requestFinished(requestId: string, model: string, usage: { promptTokens: number; completionTokens: number }) {
    const req = this.requests.get(requestId) || { model, promptTokens: 0, completionTokensStreamed: 0, startedAt: Date.now() }

    // Reconcile streamed vs final completion tokens
    const additionalOut = Math.max(0, usage.completionTokens - req.completionTokensStreamed)

    // Update totals
    this.totalRequests += 1
    this.totalPromptTokens += usage.promptTokens
    this.totalCompletionTokens += additionalOut

    const mt = (this.perModel[model] ||= { requests: 0, promptTokens: 0, completionTokens: 0, costUsd: 0 })
    mt.requests += 1
    mt.promptTokens += usage.promptTokens
    mt.completionTokens += additionalOut

    const p = this.pricing.getPricing(model)
    if (p) {
      // input cost
      const inputCost = tokensToUsd(usage.promptTokens, p.inputPer1K)
      this.costUsd += inputCost
      mt.costUsd += inputCost
      // additional output if any (streamed already billed incrementally)
      if (additionalOut > 0) {
        const addOutCost = tokensToUsd(additionalOut, p.outputPer1K)
        this.costUsd += addOutCost
        mt.costUsd += addOutCost
      }
    }

    this.requests.delete(requestId)
    this.touch()

    this.bus.emit({ type: 'llm/request/finished', runId: this.runId, at: Date.now(), requestId, model, usage })
    this.emitUpdate()
    this.checkBudget()
  }

  private touch() {
    this.updatedAt = Date.now()
  }

  private emitUpdate() {
    this.bus.emit({ type: 'telemetry/updated', runId: this.runId, at: Date.now(), snapshot: this.snapshot() })
  }

  private checkBudget() {
    if (!this.budget || this.status === 'stopped') return
    const totalTokens = this.totalPromptTokens + this.totalCompletionTokens

    if (this.budget.maxTokens != null && totalTokens > this.budget.maxTokens) {
      this.onBudgetExceeded('tokens', totalTokens, this.budget.maxTokens)
      return
    }
    if (this.budget.maxCostUsd != null && this.costUsd > this.budget.maxCostUsd) {
      this.onBudgetExceeded('cost', this.costUsd, this.budget.maxCostUsd)
      return
    }
  }

  private onBudgetExceeded(metric: 'cost' | 'tokens', value: number, limit: number) {
    if (this.status === 'stopped') return
    this.bus.emit({ type: 'budget/exceeded', runId: this.runId, at: Date.now(), metric, value, limit })
    this.status = 'stopped'
    this.stopReason = 'budget-exceeded'
    try {
      // @ts-expect-error reason supported in newer runtimes
      this.controller?.abort('budget-exceeded')
    } catch {
      this.controller?.abort()
    }
    this.bus.emit({ type: 'run/stopped', runId: this.runId, at: Date.now(), reason: 'budget-exceeded' })
    this.emitUpdate()
  }
}
