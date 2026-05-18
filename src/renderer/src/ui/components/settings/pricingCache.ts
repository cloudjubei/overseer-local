import type { PricingSnapshot } from '@api/types'

const STALE_MS = 24 * 60 * 60 * 1000

let cachedSnapshot: PricingSnapshot | null = null

export function getCachedPricing(): PricingSnapshot | null {
  return cachedSnapshot
}

export function setCachedPricing(snapshot: PricingSnapshot): void {
  cachedSnapshot = snapshot
}

export function isStale(snapshot: PricingSnapshot | null): boolean {
  if (!snapshot) return true
  const t = Date.parse(snapshot.updatedAt)
  if (Number.isNaN(t)) return true
  return Date.now() - t > STALE_MS
}
