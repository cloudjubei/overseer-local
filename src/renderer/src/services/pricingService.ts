import {
  getPricing,
  refreshPricing as refreshPricingApi,
} from 'thefactory-ui/headless/api'
import type {
  ModelPrice,
  PricingSnapshot,
} from 'thefactory-ui/headless/api'
export type { ModelPrice }

let cache: PricingSnapshot | null = null
let inflight: Promise<PricingSnapshot> | null = null

function emptySnapshot(): PricingSnapshot {
  return { updatedAt: new Date().toISOString(), prices: [] }
}

async function fetchPricing(): Promise<PricingSnapshot> {
  if (cache) return cache
  if (inflight) return inflight

  inflight = getPricing({ throwOnError: true })
    .then(({ data }) => {
      cache = data ?? emptySnapshot()
      inflight = null
      return cache
    })
    .catch(() => {
      inflight = null
      cache = emptySnapshot()
      return cache
    })

  return inflight
}

export async function refreshPricing(provider?: string, url?: string): Promise<PricingSnapshot> {
  try {
    const { data } = await refreshPricingApi({
      body: { provider, url },
      throwOnError: true,
    })
    cache = data ?? emptySnapshot()
    return cache
  } catch {
    return cache ?? emptySnapshot()
  }
}

export async function getPricingState(): Promise<PricingSnapshot> {
  return fetchPricing()
}

function normalizeProvider(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

function normalizeModel(s: string) {
  const raw = String(s || '')
    .trim()
    .toLowerCase()
  const seg = raw.split(/[/:]/).pop() || raw
  return seg
}

export async function getPrice(provider?: string, model?: string): Promise<ModelPrice | undefined> {
  const state = await fetchPricing()
  if (!provider || !model) return undefined
  const p = normalizeProvider(provider)
  const m = normalizeModel(model)

  const prices = state.prices || []

  let rec = prices.find((r) => normalizeProvider(r.provider) === p && normalizeModel(r.model) === m)
  if (rec) return rec

  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider) === p && normalizeModel(m).includes(normalizeModel(r.model)),
  )
  if (rec) return rec

  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider) === p && normalizeModel(r.model).includes(normalizeModel(m)),
  )
  if (rec) return rec

  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider).includes(p) &&
      normalizeModel(m).includes(normalizeModel(r.model)),
  )
  if (rec) return rec

  rec = prices.find(
    (r) =>
      normalizeModel(m).includes(normalizeModel(r.model)) ||
      normalizeModel(r.model).includes(normalizeModel(m)),
  )
  return rec
}
