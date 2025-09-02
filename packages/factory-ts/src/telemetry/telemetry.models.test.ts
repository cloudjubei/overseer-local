import { describe, it, expect } from 'vitest'
import { SimpleEventBus, DefaultRunHandle } from '../events/runtime'
import { Telemetry } from './telemetry'
import type { ModelPricingProvider } from '../llm/types'

const mockPricing: ModelPricingProvider = {
  getPricing(model: string) {
    if (model === 'modelA') return { inputPer1K: 0.002, outputPer1K: 0.004 }
    if (model === 'modelB') return { inputPer1K: 0.01, outputPer1K: 0.02 }
    return undefined
  }
}

describe('Telemetry multi-model accounting', () => {
  it('tracks per-model and total costs across requests', () => {
    const bus = new SimpleEventBus()
    const run = new DefaultRunHandle('run_multi', bus)
    const tel = new Telemetry({ runId: run.runId, bus, pricing: mockPricing })

    tel.requestStarted('r1', 'modelA')
    tel.requestFinished('r1', 'modelA', { promptTokens: 500, completionTokens: 100 })
    // cost: 0.5k*0.002 + 0.1k*0.004 = 0.001 + 0.0004 = 0.0014

    tel.requestStarted('r2', 'modelB')
    tel.streamDelta('r2', 50) // 0.05k * 0.02 = 0.001
    tel.requestFinished('r2', 'modelB', { promptTokens: 1000, completionTokens: 200 })
    // finish adds input(1k*0.01=0.01) + additional out (150 left => 0.15k*0.02=0.003)

    const snap = tel.snapshot()
    expect(snap.totalPromptTokens).toBe(1500)
    expect(snap.totalCompletionTokens).toBe(300)

    const mA = snap.perModel['modelA']
    const mB = snap.perModel['modelB']
    expect(mA.requests).toBe(1)
    expect(mB.requests).toBe(1)

    const costA = 0.0014
    const costB = 0.001 + 0.01 + 0.003 // streamed + input + extra output
    expect(snap.costUsd).toBeCloseTo(costA + costB, 6)
    expect(mA.costUsd).toBeCloseTo(costA, 6)
    expect(mB.costUsd).toBeCloseTo(costB, 6)
  })
})
