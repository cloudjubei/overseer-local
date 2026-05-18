import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import type { LLMCostAggregateContent } from 'thefactory-tools'
import { costsService } from '@renderer/services/costsService'

export type CostsContextValue = {
  // Single key lookup (cached/deduped by the provider)
  getCost: (chatKey: string) => Promise<LLMCostAggregateContent | undefined>

  // Batch lookup convenience that dedupes keys and shares the same cache
  getCosts: (chatKeys: string[]) => Promise<Record<string, LLMCostAggregateContent | undefined>>

  // For when the UI knows a cost group changed and wants fresh data
  invalidate: (chatKey?: string) => void
}

const CostsContext = createContext<CostsContextValue | null>(null)

const DEFAULT_TTL_MS = 15_000

type CacheEntry = {
  expiresAt: number
  value?: LLMCostAggregateContent | undefined
  inFlight?: Promise<LLMCostAggregateContent | undefined>
}

export function CostsProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())

  const invalidate = useCallback(
    (chatKey?: string) => {
      if (!chatKey) {
        cacheRef.current.clear()
        return
      }
      cacheRef.current.delete(chatKey)
    },
    [cacheRef],
  )

  const getCost = useCallback(
    async (chatKey: string) => {
      const t = Date.now()
      const cache = cacheRef.current
      const existing = cache.get(chatKey)

      if (existing && existing.expiresAt > t) {
        if (existing.inFlight) return existing.inFlight
        return existing.value
      }

      const inFlight = costsService.getCost(chatKey)
      cache.set(chatKey, { expiresAt: t + DEFAULT_TTL_MS, inFlight })

      try {
        const value = await inFlight
        cache.set(chatKey, { expiresAt: Date.now() + DEFAULT_TTL_MS, value })
        return value
      } catch (err) {
        cache.delete(chatKey)
        throw err
      }
    },
    [cacheRef],
  )

  const getCosts = useCallback(
    async (chatKeys: string[]) => {
      const unique = Array.from(new Set(chatKeys.filter(Boolean)))
      const pairs = await Promise.all(
        unique.map(async (k) => {
          try {
            return [k, await getCost(k)] as const
          } catch {
            return [k, undefined] as const
          }
        }),
      )
      const out: Record<string, LLMCostAggregateContent | undefined> = {}
      for (const [k, v] of pairs) out[k] = v
      return out
    },
    [getCost],
  )

  const value = useMemo<CostsContextValue>(
    () => ({
      getCost,
      getCosts,
      invalidate,
    }),
    [getCost, getCosts, invalidate],
  )

  return <CostsContext.Provider value={value}>{children}</CostsContext.Provider>
}

export function useCosts(): CostsContextValue {
  const ctx = useContext(CostsContext)
  if (!ctx) throw new Error('useCosts must be used within CostsProvider')
  return ctx
}
