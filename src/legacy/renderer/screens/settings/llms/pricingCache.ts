import type { PricingState } from 'thefactory-tools'

const STALE_MS = 24 * 60 * 60 * 1000

let cachedSnapshot: PricingState | null = null

export function getCachedPricing(): PricingState | null {
  return cachedSnapshot
}

export function setCachedPricing(snapshot: PricingState): void {
  cachedSnapshot = snapshot
}

export function isStale(snapshot: PricingState | null): boolean {
  if (!snapshot) return true
  const t = Date.parse(snapshot.updatedAt)
  if (Number.isNaN(t)) return true
  return Date.now() - t > STALE_MS
}
