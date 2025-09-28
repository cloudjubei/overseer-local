/* Renderer-side pricing service: fetch and cache pricing from Electron preload (window.factory) */

export type PricingRecord = {
  provider: string
  model: string
  inputPerMTokensUSD: number
  outputPerMTokensUSD: number
}

export type PricingState = {
  updatedAt: string
  prices: PricingRecord[]
}

let cache: PricingState | null = null
let inflight: Promise<PricingState> | null = null

async function fetchPricing(): Promise<PricingState> {
  if (cache) return cache
  if (inflight) return inflight
  const w: any = window as any
  const fn = w?.factory?.getPricing
  inflight = Promise.resolve()
    .then(() => (fn ? fn() : { updatedAt: new Date().toISOString(), prices: [] }))
    .then((state: any) => {
      cache = state || { updatedAt: new Date().toISOString(), prices: [] }
      inflight = null
      return cache!
    })
    .catch(() => {
      inflight = null
      cache = { updatedAt: new Date().toISOString(), prices: [] }
      return cache!
    })
  return inflight
}

export async function refreshPricing(provider?: string, url?: string): Promise<PricingState> {
  const w: any = window as any
  const fn = w?.factory?.refreshPricing
  try {
    const state = await (fn
      ? fn(provider, url)
      : Promise.resolve({ updatedAt: new Date().toISOString(), prices: [] }))
    cache = state || { updatedAt: new Date().toISOString(), prices: [] }
    return cache!
  } catch {
    return cache || { updatedAt: new Date().toISOString(), prices: [] }
  }
}

export async function getPricingState(): Promise<PricingState> {
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
  // Drop any namespace/prefix like "openai/" or "openai:" and keep the last segment
  const seg = raw.split(/[/:]/).pop() || raw
  return seg
}

export async function getPrice(
  provider?: string,
  model?: string,
): Promise<PricingRecord | undefined> {
  const state = await fetchPricing()
  if (!provider || !model) return undefined
  const p = normalizeProvider(provider)
  const m = normalizeModel(model)

  const prices = state.prices || []

  // 1) Exact match on normalized provider+model
  let rec = prices.find((r) => normalizeProvider(r.provider) === p && normalizeModel(r.model) === m)
  if (rec) return rec

  // 2) Same provider, model variant (requested model contains known base, e.g., gpt-4o-mini-2024...)
  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider) === p && normalizeModel(m).includes(normalizeModel(r.model)),
  )
  if (rec) return rec

  // 3) Same provider, reverse containment (known model contains requested, unlikely but defensive)
  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider) === p && normalizeModel(r.model).includes(normalizeModel(m)),
  )
  if (rec) return rec

  // 4) Provider fuzzy match (aliases), model variant containment
  rec = prices.find(
    (r) =>
      normalizeProvider(r.provider).includes(p) &&
      normalizeModel(m).includes(normalizeModel(r.model)),
  )
  if (rec) return rec

  // 5) Last resort: any model that loosely matches
  rec = prices.find(
    (r) =>
      normalizeModel(m).includes(normalizeModel(r.model)) ||
      normalizeModel(r.model).includes(normalizeModel(m)),
  )
  return rec
}
