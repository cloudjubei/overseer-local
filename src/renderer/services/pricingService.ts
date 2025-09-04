/* Renderer-side pricing service: fetch and cache pricing from Electron preload (window.factory) */

export type PricingRecord = {
  provider: string;
  model: string;
  inputPerMTokensUSD: number;
  outputPerMTokensUSD: number;
};

export type PricingState = {
  updatedAt: string;
  prices: PricingRecord[];
};

let cache: PricingState | null = null;
let inflight: Promise<PricingState> | null = null;

async function fetchPricing(): Promise<PricingState> {
  if (cache) return cache;
  if (inflight) return inflight;
  const w: any = window as any;
  const fn = w?.factory?.getPricingState || w?.factory?.pricingGet;
  inflight = Promise.resolve()
    .then(() => (fn ? fn() : { updatedAt: new Date().toISOString(), prices: [] }))
    .then((state: any) => {
      cache = state || { updatedAt: new Date().toISOString(), prices: [] };
      inflight = null;
      return cache!;
    })
    .catch(() => {
      inflight = null;
      cache = { updatedAt: new Date().toISOString(), prices: [] };
      return cache!;
    });
  return inflight;
}

export async function refreshPricing(provider?: string, url?: string): Promise<PricingState> {
  const w: any = window as any;
  const fn = w?.factory?.refreshPricing;
  try {
    const state = await (fn ? fn(provider, url) : Promise.resolve({ updatedAt: new Date().toISOString(), prices: [] }));
    cache = state || { updatedAt: new Date().toISOString(), prices: [] };
    return cache;
  } catch {
    return cache || { updatedAt: new Date().toISOString(), prices: [] };
  }
}

export async function getPricingState(): Promise<PricingState> {
  return fetchPricing();
}

export async function getPrice(provider?: string, model?: string): Promise<PricingRecord | undefined> {
  const state = await fetchPricing();
  if (!provider || !model) return undefined;
  const p = String(provider).toLowerCase();
  const m = String(model).toLowerCase();
  // Try exact match first
  let rec = state.prices.find((r) => r && String(r.provider).toLowerCase() === p && String(r.model).toLowerCase() === m);
  if (rec) return rec;
  // Try partial matches (models with prefixes or provider aliases)
  rec = state.prices.find((r) => r && String(r.provider).toLowerCase().includes(p) && String(r.model).toLowerCase() === m);
  if (rec) return rec;
  rec = state.prices.find((r) => r && String(r.provider).toLowerCase() === p && String(r.model).toLowerCase().includes(m));
  return rec;
}
