import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createFeature,
  createStory,
  deleteFeature,
  deleteStory,
  getStoriesOrder,
  listStories,
  reorderStories,
  updateFeature,
  updateStory,
  type Feature,
  type FeatureCreateInput,
  type FeatureEditInput,
  type GetStoryResponse,
  type StoryCreateInput,
  type StoryEditInput,
} from 'thefactory-ui/headless/api'
import { useApi } from './ApiContext'
import { useProjects } from './ProjectsContext'

/** Mirrors desktop's `ResolvedStoryRef`. */
export type ResolvedStoryRef = {
  kind: 'story'
  id: string
  storyId: string
  story: GetStoryResponse
  display: string
}
/** Mirrors desktop's `ResolvedFeatureRef`. */
export type ResolvedFeatureRef = {
  kind: 'feature'
  id: string
  storyId: string
  featureId: string
  story: GetStoryResponse
  feature: Feature
  display: string
}
export type ResolvedRef = ResolvedStoryRef | ResolvedFeatureRef
export type InvalidRefError = {
  id: string
  code: 'EMPTY' | 'BAD_FORMAT' | 'BAD_STORY_ID' | 'STORY_NOT_FOUND' | 'FEATURE_NOT_FOUND'
  message: string
}

export type StoriesContextValue = {
  /** True once the first fetch for the active project has completed. */
  isLoaded: boolean
  /** Last fetch error; cleared on the next successful refresh. */
  loadError: Error | null
  /** Stories for the active project in display order (1-based index = position + 1).
   *  Order tracks the backend's `order.json` (watched via WS), with any not-yet-
   *  ordered stories appended at the end. */
  stories: GetStoryResponse[]
  getStory: (storyId: string) => GetStoryResponse | undefined
  getFeature: (storyId: string, featureId: string) => Feature | undefined
  /** Display index (1-based) for a story in the current project, or undefined. */
  storyDisplayIndex: (storyId: string) => number | undefined
  /** Display index (1-based) for a feature within its story, or undefined. */
  featureDisplayIndex: (storyId: string, featureId: string) => number | undefined

  /** Resolve a `"storyId"` / `"storyId.featureId"` / `"3"` / `"3.2"` dep
   *  string against the loaded project. Mirrors desktop's API. */
  resolveDependency: (dependency: string) => ResolvedRef | InvalidRefError
  /** Normalise a display-index ref (e.g. `"3.2"`) to the canonical
   *  `"uuid.uuid"` form. Pass-through for unresolvable inputs. */
  normalizeDependency: (dependency: string) => string
  /** Resolved blockers of a story (or feature). */
  getBlockers: (storyId: string, featureId?: string) => (ResolvedRef | InvalidRefError)[]
  /** Stories/features that depend on the given id ("blocks" relation). */
  getBlockersOutbound: (id: string) => ResolvedRef[]

  createStory: (input: StoryCreateInput) => Promise<GetStoryResponse>
  updateStory: (storyId: string, patch: StoryEditInput) => Promise<GetStoryResponse>
  deleteStory: (storyId: string) => Promise<void>

  createFeature: (storyId: string, input: FeatureCreateInput) => Promise<GetStoryResponse>
  updateFeature: (
    storyId: string,
    featureId: string,
    patch: FeatureEditInput,
  ) => Promise<GetStoryResponse>
  deleteFeature: (storyId: string, featureId: string) => Promise<void>

  /** Moves the story one slot up or down in the project's display order. No-op at the ends. */
  moveStory: (storyId: string, direction: 'up' | 'down') => Promise<void>
  /** Moves a story to an arbitrary 0-based position. No-op when target == current. */
  reorderStory: (storyId: string, toIndex: number) => Promise<void>

  refresh: () => Promise<void>
}

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

const StoriesContext = createContext<StoriesContextValue | null>(null)

export function StoriesProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { activeProjectId } = useProjects()

  const [storiesRaw, setStoriesRaw] = useState<GetStoryResponse[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  // Tracks the latest active project so an in-flight `refresh()` whose project
  // has since been switched away from drops its result instead of clobbering
  // the new project's stories (stale-response race → flicker + stale list).
  const activeProjectIdRef = useRef(activeProjectId)
  activeProjectIdRef.current = activeProjectId

  const refresh = useCallback(async () => {
    const reqProjectId = activeProjectId
    if (!reqProjectId) {
      setStoriesRaw([])
      setOrder([])
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      const [storiesRes, orderRes] = await Promise.all([
        listStories({ path: { projectId: reqProjectId }, throwOnError: true }),
        getStoriesOrder({ path: { projectId: reqProjectId }, throwOnError: true }),
      ])
      if (activeProjectIdRef.current !== reqProjectId) return
      setStoriesRaw(storiesRes.data)
      setOrder(orderRes.data ?? [])
      setLoadError(null)
    } catch (err) {
      if (activeProjectIdRef.current !== reqProjectId) return
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (activeProjectIdRef.current === reqProjectId) setIsLoaded(true)
    }
  }, [activeProjectId])

  // When the active project changes, clear the old list and reload. The
  // intermediate "empty + not loaded" state is what surfaces the loading
  // spinner while the new project's stories are fetched.
  useEffect(() => {
    setIsLoaded(false)
    setStoriesRaw([])
    setOrder([])
    setLoadError(null)
    void refresh()
  }, [activeProjectId, refresh])

  // WS-driven invalidation. `stories:updated` covers both story payload
  // changes (create/update/delete) and reorder events — the backend
  // broadcasts the same channel on every mutation in [stories.ts]. Coarse-
  // grained refetch for now; switch to incremental updates once we need to.
  useEffect(() => ws.on('stories:updated', () => void refresh()), [ws, refresh])

  // Apply `order.json` to the raw story list: ids present in `order` come
  // first (in that order), any stories on disk not yet in `order.json`
  // (orphans / freshly added in another client) get appended at the end.
  // Stale ids in `order` with no matching story are silently dropped.
  const stories = useMemo<GetStoryResponse[]>(() => {
    if (storiesRaw.length === 0) return storiesRaw
    const byId = new Map<string, GetStoryResponse>()
    for (const s of storiesRaw) byId.set(s.id, s)
    const out: GetStoryResponse[] = []
    const seen = new Set<string>()
    for (const id of order) {
      const s = byId.get(id)
      if (!s) continue
      out.push(s)
      seen.add(id)
    }
    for (const s of storiesRaw) {
      if (!seen.has(s.id)) out.push(s)
    }
    return out
  }, [storiesRaw, order])

  const storyIndex = useMemo(() => {
    const byId = new Map<string, GetStoryResponse>()
    const positions = new Map<string, number>()
    stories.forEach((s, i) => {
      byId.set(s.id, s)
      positions.set(s.id, i + 1)
    })
    return { byId, positions }
  }, [stories])

  const getStoryFn = useCallback((storyId: string) => storyIndex.byId.get(storyId), [storyIndex])

  const getFeature = useCallback(
    (storyId: string, featureId: string): Feature | undefined =>
      storyIndex.byId.get(storyId)?.features.find((f) => f.id === featureId),
    [storyIndex],
  )

  const storyDisplayIndex = useCallback(
    (storyId: string) => storyIndex.positions.get(storyId),
    [storyIndex],
  )

  const featureDisplayIndex = useCallback(
    (storyId: string, featureId: string) => {
      const story = storyIndex.byId.get(storyId)
      if (!story) return undefined
      const idx = story.features.findIndex((f) => f.id === featureId)
      return idx === -1 ? undefined : idx + 1
    },
    [storyIndex],
  )

  // display-index → uuid maps (mirrors desktop)
  const storyDisplayToId = useMemo(() => {
    const mapping: Record<string, string> = {}
    stories.forEach((s, i) => {
      mapping[`${i + 1}`] = s.id
    })
    return mapping
  }, [stories])
  const featureDisplayToIdByStory = useMemo(() => {
    const mapping: Record<string, Record<string, string>> = {}
    for (const s of stories) {
      const fmap: Record<string, string> = {}
      s.features.forEach((f, idx) => {
        fmap[`${idx}`] = f.id
        fmap[`${idx + 1}`] = f.id
      })
      mapping[s.id] = fmap
    }
    return mapping
  }, [stories])

  const normalizeDependency = useCallback(
    (dependency: string): string => {
      const parts = dependency.split('.')
      if (parts.length === 1) {
        const a = parts[0]
        if (isUUID(a) && storyIndex.byId.has(a)) return a
        return storyDisplayToId[a] || dependency
      }
      const a = parts[0]
      const b = parts.slice(1).join('.')
      const storyId = isUUID(a) ? a : storyDisplayToId[a] || a
      const fmap = featureDisplayToIdByStory[storyId] || {}
      const featureId = isUUID(b) ? b : fmap[b] || b
      return `${storyId}.${featureId}`
    },
    [storyIndex, storyDisplayToId, featureDisplayToIdByStory],
  )

  const resolveDependency = useCallback(
    (dependency: string): ResolvedRef | InvalidRefError => {
      if (!activeProjectId) {
        return { id: dependency, code: 'EMPTY', message: "Story wasn't found" }
      }
      const normalized = normalizeDependency(dependency)
      const parts = normalized.split('.')
      const story = storyIndex.byId.get(parts[0])
      if (!story) {
        return { id: normalized, code: 'STORY_NOT_FOUND', message: "Story wasn't found" }
      }
      const sIndex = storyDisplayIndex(story.id)
      if (parts.length > 1) {
        const feature = story.features.find((f) => f.id === parts[1])
        if (!feature) {
          return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
        }
        const fIndex = featureDisplayIndex(story.id, feature.id)
        return {
          kind: 'feature',
          id: normalized,
          storyId: parts[0],
          featureId: parts[1],
          story,
          feature,
          display: `${sIndex ?? '?'}.${fIndex ?? '?'}`,
        }
      }
      return {
        kind: 'story',
        id: normalized,
        storyId: parts[0],
        story,
        display: `${sIndex ?? '?'}`,
      }
    },
    [activeProjectId, normalizeDependency, storyIndex, storyDisplayIndex, featureDisplayIndex],
  )

  const getBlockers = useCallback(
    (storyId: string, featureId?: string): (ResolvedRef | InvalidRefError)[] => {
      if (featureId) {
        const feature = getFeature(storyId, featureId)
        return feature?.blockers?.map((d) => resolveDependency(d)) ?? []
      }
      return storyIndex.byId.get(storyId)?.blockers?.map((d) => resolveDependency(d)) ?? []
    },
    [storyIndex, getFeature, resolveDependency],
  )

  // Outbound = "X is blocked by ME" — every place where my id (or any of my
  // feature ids) appears in someone else's `blockers`. We index this lazily
  // off `stories` so it stays in sync without per-row scans.
  const outboundIndex = useMemo(() => {
    const map = new Map<string, ResolvedRef[]>()
    const push = (key: string, ref: ResolvedRef) => {
      const arr = map.get(key) ?? []
      arr.push(ref)
      map.set(key, arr)
    }
    for (const s of stories) {
      const collectFrom = (deps: ReadonlyArray<string> | undefined, fromRef: ResolvedRef) => {
        if (!deps || deps.length === 0) return
        for (const dep of deps) {
          const normalized = normalizeDependency(dep)
          push(normalized, fromRef)
          // Also index the bare story id for story-level deps so "what
          // blocks story X" lookups hit even when the dep is a feature ref.
          const head = normalized.split('.')[0]
          if (head && head !== normalized) push(head, fromRef)
        }
      }
      const sIndex = storyDisplayIndex(s.id) ?? 0
      const storyRef: ResolvedStoryRef = {
        kind: 'story',
        id: s.id,
        storyId: s.id,
        story: s,
        display: `${sIndex}`,
      }
      collectFrom(s.blockers, storyRef)
      for (const f of s.features) {
        const fIndex = featureDisplayIndex(s.id, f.id) ?? 0
        const featureRef: ResolvedFeatureRef = {
          kind: 'feature',
          id: `${s.id}.${f.id}`,
          storyId: s.id,
          featureId: f.id,
          story: s,
          feature: f,
          display: `${sIndex}.${fIndex}`,
        }
        collectFrom(f.blockers, featureRef)
      }
    }
    return map
  }, [stories, normalizeDependency, storyDisplayIndex, featureDisplayIndex])

  const getBlockersOutbound = useCallback(
    (id: string): ResolvedRef[] => outboundIndex.get(id) ?? [],
    [outboundIndex],
  )

  const requireProject = useCallback(() => {
    if (!activeProjectId) {
      throw new Error('No active project — cannot perform story mutation')
    }
    return activeProjectId
  }, [activeProjectId])

  const createStoryImpl = useCallback(
    async (input: StoryCreateInput) => {
      const { data } = await createStory({
        path: { projectId: requireProject() },
        body: input,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const updateStoryImpl = useCallback(
    async (storyId: string, patch: StoryEditInput) => {
      const { data } = await updateStory({
        path: { projectId: requireProject(), storyId },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const deleteStoryImpl = useCallback(
    async (storyId: string) => {
      await deleteStory({
        path: { projectId: requireProject(), storyId },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh],
  )

  const createFeatureImpl = useCallback(
    async (storyId: string, input: FeatureCreateInput) => {
      const { data } = await createFeature({
        path: { projectId: requireProject(), storyId },
        body: input,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const updateFeatureImpl = useCallback(
    async (storyId: string, featureId: string, patch: FeatureEditInput) => {
      const { data } = await updateFeature({
        path: { projectId: requireProject(), storyId, featureId },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const deleteFeatureImpl = useCallback(
    async (storyId: string, featureId: string) => {
      await deleteFeature({
        path: { projectId: requireProject(), storyId, featureId },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh],
  )

  const moveStory = useCallback(
    async (storyId: string, direction: 'up' | 'down') => {
      const id = requireProject()
      const fromIndex = stories.findIndex((s) => s.id === storyId)
      if (fromIndex === -1) return
      const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
      if (toIndex < 0 || toIndex >= stories.length) return
      await reorderStories({
        path: { projectId: id },
        body: { fromIndex, toIndex },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh, stories],
  )

  const reorderStory = useCallback(
    async (storyId: string, toIndex: number) => {
      const id = requireProject()
      const fromIndex = stories.findIndex((s) => s.id === storyId)
      if (fromIndex === -1) return
      const clamped = Math.max(0, Math.min(stories.length - 1, toIndex))
      if (clamped === fromIndex) return
      await reorderStories({
        path: { projectId: id },
        body: { fromIndex, toIndex: clamped },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh, stories],
  )

  const value = useMemo<StoriesContextValue>(
    () => ({
      isLoaded,
      loadError,
      stories,
      getStory: getStoryFn,
      getFeature,
      storyDisplayIndex,
      featureDisplayIndex,
      resolveDependency,
      normalizeDependency,
      getBlockers,
      getBlockersOutbound,
      createStory: createStoryImpl,
      updateStory: updateStoryImpl,
      deleteStory: deleteStoryImpl,
      createFeature: createFeatureImpl,
      updateFeature: updateFeatureImpl,
      deleteFeature: deleteFeatureImpl,
      moveStory,
      reorderStory,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      stories,
      getStoryFn,
      getFeature,
      storyDisplayIndex,
      featureDisplayIndex,
      resolveDependency,
      normalizeDependency,
      getBlockers,
      getBlockersOutbound,
      createStoryImpl,
      updateStoryImpl,
      deleteStoryImpl,
      createFeatureImpl,
      updateFeatureImpl,
      deleteFeatureImpl,
      moveStory,
      reorderStory,
      refresh,
    ],
  )

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

export function useStories(): StoriesContextValue {
  const ctx = useContext(StoriesContext)
  if (!ctx) throw new Error('useStories must be used within StoriesProvider')
  return ctx
}
