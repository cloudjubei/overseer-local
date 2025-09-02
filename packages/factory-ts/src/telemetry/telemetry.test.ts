import { describe, it, expect } from 'vitest'
import { SimpleEventBus, DefaultRunHandle } from '../events/runtime'
import { Telemetry } from './telemetry'
import { resolveOpenAIPricing } from '../llm/costs'
import type { ModelPricingProvider } from '../llm/types'

const pricingProvider: ModelPricingProvider = {
  getPricing(model: string) {
    return resolveOpenAIPricing(model)
  }
}

describe('Telemetry cost calculation (OpenAI)', () => {
  it('computes cost for request finish (gpt-4o)', () => {
    const bus = new SimpleEventBus()
    const run = new DefaultRunHandle('run_test', bus)
    const telemetry = new Telemetry({ runId: run.runId, bus, pricing: pricingProvider })

    const requestId = 'req1'
    telemetry.requestStarted(requestId, 'gpt-4o')
    telemetry.requestFinished(requestId, 'gpt-4o', { promptTokens: 1000, completionTokens: 500 })

    const snap = telemetry.snapshot()
    expect(snap.totalPromptTokens).toBe(1000)
    expect(snap.totalCompletionTokens).toBe(500)
    // 1000 in @ 0.005 + 500 out @ 0.015 = 0.0125
    expect(snap.costUsd).toBeCloseTo(0.0125, 6)
  })

  it('updates incrementally on streaming and reconciles at finish', () => {
    const bus = new SimpleEventBus()
    const run = new DefaultRunHandle('run_stream', bus)
    const telemetry = new Telemetry({ runId: run.runId, bus, pricing: pricingProvider })

    const requestId = 'req-stream'
    telemetry.requestStarted(requestId, 'gpt-4o')
    telemetry.streamDelta(requestId, 100) // cost 100/1000 * 0.015 = 0.0015
    telemetry.requestFinished(requestId, 'gpt-4o', { promptTokens: 0, completionTokens: 150 }) // extra 50 => 0.00075

    const snap = telemetry.snapshot()
    expect(snap.totalPromptTokens).toBe(0)
    expect(snap.totalCompletionTokens).toBe(150)
    expect(snap.costUsd).toBeCloseTo(0.0015 + 0.00075, 6)
  })
})

describe('Telemetry budget enforcement', () => {
  it('aborts when cost exceeds maxCostUsd', () => {
    const bus = new SimpleEventBus()
    const controller = new AbortController()
    const run = new DefaultRunHandle('run_budget', bus, controller)

    const events: any[] = []
    bus.on('budget/exceeded', e => events.push(e))

    const telemetry = new Telemetry({ runId: run.runId, bus, pricing: pricingProvider, budget: { maxCostUsd: 0.001 }, abortController: controller })

    const requestId = 'req-budget'
    telemetry.requestStarted(requestId, 'gpt-4o')

    // Stream tokens until exceed 0.001 USD at 0.015/1k => threshold ~ 66.666 tokens
    telemetry.streamDelta(requestId, 60)
    expect(telemetry.snapshot().status).toBe('running')
    telemetry.streamDelta(requestId, 10) // 70 total => exceed

    expect(events.length).toBe(1)
    expect(events[0].metric).toBe('cost')
    expect(run.signal.aborted).toBe(true)

    const snap = telemetry.snapshot()
    expect(snap.status).toBe('stopped')
    expect(snap.stopReason).toBe('budget-exceeded')
  })

  it('aborts when total tokens exceed maxTokens', () => {
    const bus = new SimpleEventBus()
    const controller = new AbortController()
    const run = new DefaultRunHandle('run_tok_budget', bus, controller)

    const events: any[] = []
    bus.on('budget/exceeded', e => events.push(e))

    const telemetry = new Telemetry({ runId: run.runId, bus, pricing: pricingProvider, budget: { maxTokens: 100 }, abortController: controller })

    const requestId = 'req-budget-tokens'
    telemetry.requestStarted(requestId, 'gpt-4o')
    telemetry.requestFinished(requestId, 'gpt-4o', { promptTokens: 60, completionTokens: 30 })
    expect(telemetry.snapshot().status).toBe('running')
    telemetry.requestStarted('req2', 'gpt-4o')
    telemetry.streamDelta('req2', 20) // total now 110

    expect(events.length).toBe(1)
    expect(events[0].metric).toBe('tokens')
    expect(run.signal.aborted).toBe(true)

    const snap = telemetry.snapshot()
    expect(snap.status).toBe('stopped')
    expect(snap.stopReason).toBe('budget-exceeded')
  })
})
