import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react'
import { getCostsByChat } from 'thefactory-ui/headless/api'
import type { LlmCostAggregateContent } from 'thefactory-ui/headless/api'
export type CostsContextValue = {
  getCost: (chatKey: string) => Promise<LlmCostAggregateContent | undefined>
  getCosts: (chatKeys: string[]) => Promise<Record<string, LlmCostAggregateContent | undefined>>
  invalidate: (chatKey?: string) => void
}

const CostsContext = createContext<CostsContextValue | null>(null)

const DEFAULT_TTL_MS = 15_000

type CacheEntry = {
  expiresAt: number
  value?: LlmCostAggregateContent | undefined
  inFlight?: Promise<LlmCostAggregateContent | undefined>
}

async function fetchCost(chatKey: string): Promise<LlmCostAggregateContent | undefined> {
  try {
    const { data } = await getCostsByChat({ path: { chatKey }, throwOnError: true })
    return data
  } catch {
    return undefined
  }
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

      const inFlight = fetchCost(chatKey)
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
      const out: Record<string, LlmCostAggregateContent | undefined> = {}
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
