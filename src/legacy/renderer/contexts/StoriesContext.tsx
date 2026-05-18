import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  InvalidRefError,
  ResolvedFeatureRef,
  ResolvedRef,
  ResolvedStoryRef,
  storiesService,
} from '../services/storiesService'
import { projectsService } from '../services/projectsService'
import { useProjectContext } from './ProjectContext'
import {
  Feature,
  Story,
  StoryCreateInput,
  StoryEditInput,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  StoryUpdate,
} from 'thefactory-tools'

export type StoriesContextValue = {
  storyIdsByProject: Record<string, string[]>
  storyOrdersByProject: Record<string, string[]>
  storiesById: Record<string, Story>
  featuresById: Record<string, Feature>
  /** True once we've at least completed one `listStories` round-trip for
   *  this project. Distinguishes "loaded but empty" from "still loading"
   *  so the UI can show a Spinner during the gap instead of a flicker of
   *  "No stories found." */
  isProjectLoaded: (projectId?: string) => boolean
  createStory: (updates: StoryCreateInput) => Promise<Story | undefined>
  updateStory: (storyId: string, updates: StoryEditInput) => Promise<Story | undefined>
  deleteStory: (storyId: string) => Promise<void>
  reorderStory: (payload: ReorderPayload) => Promise<string[] | undefined>
  getStoryDisplayIndex: (storyId: string) => number | undefined
  addFeature: (storyId: string, updates: FeatureCreateInput) => Promise<Story | undefined>
  updateFeature: (
    storyId: string,
    featureId: string,
    updates: FeatureEditInput,
  ) => Promise<Story | undefined>
  deleteFeature: (storyId: string, featureId: string) => Promise<Story | undefined>
  reorderFeature: (storyId: string, payload: ReorderPayload) => Promise<Story | undefined>
  getBlockers: (storyId: string, featureId?: string) => (ResolvedRef | InvalidRefError)[]
  getBlockersOutbound: (id: string) => ResolvedRef[]
  resolveDependency: (dependency: string) => ResolvedRef | InvalidRefError
  normalizeDependency: (dependency: string) => string
  getFeatureDisplayIndex: (storyId: string, featureId: string) => number | undefined
}

// Create the context
const StoriesContext = createContext<StoriesContextValue | null>(null)

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function normalizeDependencyInternal(
  storyDisplayToId: Record<string, string>,
  featureDisplayToIdByStory: Record<string, Record<string, string>>,
  storiesById: Record<string, Story>,
  dependency: string,
): string {
  const parts = dependency.split('.')
  if (parts.length === 1) {
    const a = parts[0]
    if (isUUID(a) && storiesById[a]) return a
    const storyId = storyDisplayToId[a]
    return storyId || dependency
  } else if (parts.length > 1) {
    const a = parts[0]
    const b = parts.slice(1).join('.') // in case of extra dots, treat rest as feature token
    let storyId = a
    if (!isUUID(a)) {
      storyId = storyDisplayToId[a] || a
    }
    let featureId = b
    if (!isUUID(b)) {
      const fmap = featureDisplayToIdByStory[storyId] || {}
      featureId = fmap[b] || b
    }
    return `${storyId}.${featureId}`
  }
  return dependency
}

type InternalStoryUpdate = {
  storyId: string
  projectId: string
  isDelete: boolean
  story: Story | undefined
  isOrderUpdate: boolean
  order: string[] | undefined
}

export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { activeProject } = useProjectContext()

  const [storyIdsByProject, setStoryIdsByProject] = useState<Record<string, string[]>>({})
  const [storyOrdersByProject, setStoryOrdersByProject] = useState<Record<string, string[]>>({})
  const [storiesById, setStoriesById] = useState<Record<string, Story>>({})
  const [featuresById, setFeaturesById] = useState<Record<string, Feature>>({})
  const [blockersOutboundById, _] = useState<Record<string, ResolvedRef[]>>({})
  /** Projects whose `listStories` round-trip has completed at least once. */
  const [loadedProjectIds, setLoadedProjectIds] = useState<Set<string>>(new Set())
  const isProjectLoaded = useCallback(
    (projectId?: string) => (projectId ? loadedProjectIds.has(projectId) : false),
    [loadedProjectIds],
  )

  const storyDisplayToId = useMemo(() => {
    const mapping: Record<string, string> = {}
    Object.values(storyOrdersByProject).forEach((orders) => {
      orders.forEach((storyId, idx) => {
        mapping[`${idx + 1}`] = storyId
      })
    })
    return mapping
  }, [storyOrdersByProject])

  const featureDisplayToIdByStory = useMemo(() => {
    const mapping: Record<string, Record<string, string>> = {}
    Object.values(storiesById).forEach((story) => {
      const featureMap: Record<string, string> = {}
      story.features.forEach((feature, idx) => {
        featureMap[`${idx}`] = feature.id
      })
      mapping[story.id] = featureMap
    })
    return mapping
  }, [storiesById])

  const getFeatureDisplayIndex = useCallback(
    (storyId: string, featureId: string): number | undefined => {
      const story = storiesById[storyId]
      if (!story) return undefined
      const index = story.features.findIndex((f) => f.id === featureId)
      if (index !== -1) return index + 1
      return undefined
    },
    [storiesById],
  )

  const updateStories = useCallback((stories: InternalStoryUpdate[]) => {
    // Functional setters so the latest committed React state — not whatever
    // closure this callback was created with — is the base for each merge.
    // Without this, back-to-back updates (initial-load batch immediately
    // followed by per-story WS events, or two WS events in the same tick)
    // race: each invocation reads the same stale `prev`, and the second
    // write stomps the first. The visible symptom was stories from every
    // project after the first one silently disappearing from
    // `storyIdsByProject`.
    setStoryIdsByProject((prev) => {
      const next = { ...prev }
      for (const { storyId, projectId, isDelete, isOrderUpdate } of stories) {
        if (isOrderUpdate) continue
        const current = (next[projectId] ?? []).filter((s) => s !== storyId)
        next[projectId] = isDelete ? current : [...current, storyId]
      }
      return next
    })
    setStoryOrdersByProject((prev) => {
      const next = { ...prev }
      for (const { projectId, order } of stories) {
        if (order) next[projectId] = order
      }
      return next
    })
    setStoriesById((prev) => {
      const next = { ...prev }
      for (const { storyId, isDelete, story, isOrderUpdate } of stories) {
        if (isOrderUpdate) continue
        delete next[storyId]
        if (!isDelete && story) next[storyId] = story
      }
      return next
    })
    setFeaturesById((prev) => {
      const next = { ...prev }
      for (const { story, isDelete, isOrderUpdate } of stories) {
        if (isOrderUpdate) continue
        if (!story) continue
        for (const f of story.features) {
          delete next[f.id]
          if (!isDelete) next[f.id] = f
        }
      }
      return next
    })
  }, [])

  const onStoryUpdate = useCallback(
    async (storyUpdate: StoryUpdate) => {
      const storyId = storyUpdate.storyId
      const projectId = storyUpdate.projectId
      const isDelete = storyUpdate.type === 'delete'
      const story = storyUpdate.story
      const isOrderUpdate = storyUpdate.type === 'order'
      const order = storyUpdate.order

      updateStories([{ storyId, projectId, isDelete, story, isOrderUpdate, order }])
    },
    [updateStories],
  )
  /** Load stories for a single project. Idempotent — functional setters
   *  merge into the latest committed state, so callers can fire this for
   *  one project, many projects, or repeatedly without state stomps. */
  const loadProject = useCallback(
    async (projectId: string) => {
      try {
        const stories = await storiesService.listStories(projectId)
        const updates: InternalStoryUpdate[] = stories.map((story) => ({
          storyId: story.id,
          projectId,
          isDelete: false,
          story,
          isOrderUpdate: false,
          order: undefined,
        }))
        const order = await storiesService.getStoriesOrder(projectId)
        if (order) {
          updates.push({
            storyId: '',
            projectId,
            isDelete: false,
            story: undefined,
            isOrderUpdate: true,
            order,
          })
        }
        if (updates.length > 0) updateStories(updates)
      } catch (e) {
        console.error(`StoriesContext: failed to load stories for project ${projectId}`, e)
      } finally {
        // Mark the project as loaded even when it has zero stories or the
        // load threw — consumers need to be able to distinguish "no
        // stories yet" from "still fetching" to avoid a flash of "No
        // stories found." on project switch.
        setLoadedProjectIds((prev) => {
          if (prev.has(projectId)) return prev
          const next = new Set(prev)
          next.add(projectId)
          return next
        })
      }
    },
    [updateStories],
  )

  useEffect(() => {
    const unsubscribe = storiesService.subscribe(onStoryUpdate)
    return () => {
      unsubscribe()
    }
  }, [onStoryUpdate])

  // Boot + project-set sync. Always fetches the canonical project list
  // from the IPC service (not React state — that risks stale closures and
  // is bound to a separate provider's lifecycle), then loads every
  // project's stories in parallel. Re-runs when projects are added /
  // removed via the projects subscription so a new project's stories
  // show up immediately, not after a reload.
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      try {
        const list = await projectsService.listProjects()
        if (cancelled) return
        await Promise.all(list.map((p) => loadProject(p.id)))
      } catch (e) {
        console.error('StoriesContext: failed to enumerate projects', e)
      }
    }
    void loadAll()
    const unsubscribe = projectsService.subscribe(async (u) => {
      if (cancelled) return
      if (u.type === 'add' || u.type === 'change') {
        await loadProject(u.projectId)
      }
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadProject])

  const getStoryDisplayIndex = useCallback(
    (storyId: string): number | undefined => {
      if (activeProject) {
        const order = storyOrdersByProject[activeProject.id]
        if (!order) return undefined
        const index = order.indexOf(storyId)
        if (index !== -1) return index + 1 // 1-based index
      }
      return
    },
    [activeProject, storyOrdersByProject],
  )
  const normalizeDependency = useCallback(
    (dependency: string): string => {
      if (!activeProject) return dependency
      return normalizeDependencyInternal(
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        dependency,
      )
    },
    [activeProject, storyDisplayToId, featureDisplayToIdByStory, storiesById],
  )

  const resolveDependency = useCallback(
    (dependency: string): ResolvedRef | InvalidRefError => {
      if (!activeProject) {
        return { id: dependency, code: 'EMPTY', message: "Story wasn't found" }
      }

      const normalized = normalizeDependencyInternal(
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        dependency,
      )

      const parts = normalized.split('.')
      const story = storiesById[parts[0]]
      if (!story) {
        return { id: normalized, code: 'STORY_NOT_FOUND', message: "Story wasn't found" }
      }
      const sIndex = getStoryDisplayIndex(story.id)

      if (parts.length > 1) {
        const feature = featuresById[parts[1]]
        if (!feature) {
          return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
        }
        const fIndex = getFeatureDisplayIndex(story.id, feature.id)

        return {
          kind: 'feature',
          id: normalized,
          storyId: parts[0],
          featureId: parts[1],
          story,
          feature,
          display: `${sIndex}.${fIndex}`,
        } as ResolvedFeatureRef
      }
      return {
        kind: 'story',
        id: normalized,
        storyId: parts[0],
        story,
        display: `${sIndex}`,
      } as ResolvedStoryRef
    },
    [
      activeProject,
      storyDisplayToId,
      featureDisplayToIdByStory,
      storiesById,
      featuresById,
      getStoryDisplayIndex,
      getFeatureDisplayIndex,
    ],
  )

  const createStory = useCallback(
    async (updates: StoryCreateInput): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized = { ...updates }
        if (Array.isArray(updates.blockers)) {
          normalized.blockers = updates.blockers.map((d: string) => normalizeDependency(d))
        }
        const story = await storiesService.createStory(activeProject.id, normalized)

        updateStories([
          {
            storyId: story.id,
            projectId: activeProject.id,
            isDelete: false,
            story,
            isOrderUpdate: false,
            order: undefined,
          },
        ])
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const updateStory = useCallback(
    async (storyId: string, updates: StoryEditInput): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized: any = { ...updates }
        if (updates.blockers) {
          normalized.blockers = updates.blockers.map((d: string) => normalizeDependency(d))
        }

        const s = await storiesService.updateStory(activeProject.id, storyId, normalized)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              isOrderUpdate: false,
              order: undefined,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const deleteStory = useCallback(
    async (storyId: string): Promise<void> => {
      if (activeProject) {
        await storiesService.deleteStory(activeProject.id, storyId)
        updateStories([
          {
            storyId,
            projectId: activeProject.id,
            isDelete: true,
            story: undefined,
            isOrderUpdate: false,
            order: undefined,
          },
        ])
      }
    },
    [activeProject, updateStories],
  )
  const reorderStory = useCallback(
    async (payload: ReorderPayload): Promise<string[] | undefined> => {
      if (activeProject) {
        return await storiesService.reorderStory(activeProject.id, payload)
      }
      return
    },
    [activeProject],
  )

  const addFeature = useCallback(
    async (storyId: string, updates: FeatureCreateInput): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        const s = await storiesService.addFeature(activeProject.id, storyId, normalized)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              isOrderUpdate: false,
              order: undefined,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const updateFeature = useCallback(
    async (
      storyId: string,
      featureId: string,
      updates: FeatureEditInput,
    ): Promise<Story | undefined> => {
      if (activeProject) {
        const normalized: any = { ...updates }
        if (Array.isArray((updates as any).blockers)) {
          normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
        }
        const s = await storiesService.updateFeature(
          activeProject.id,
          storyId,
          featureId,
          normalized,
        )
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              isOrderUpdate: false,
              order: undefined,
            },
          ])
        }
      }
      return
    },
    [activeProject, normalizeDependency, updateStories],
  )

  const deleteFeature = useCallback(
    async (storyId: string, featureId: string): Promise<Story | undefined> => {
      if (activeProject) {
        const s = await storiesService.deleteFeature(activeProject.id, storyId, featureId)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              isOrderUpdate: false,
              order: undefined,
            },
          ])
        }
      }
      return
    },
    [activeProject, updateStories],
  )

  const reorderFeature = useCallback(
    async (storyId: string, payload: ReorderPayload): Promise<Story | undefined> => {
      if (activeProject) {
        const s = await storiesService.reorderFeature(activeProject.id, storyId, payload)
        if (s) {
          updateStories([
            {
              storyId: s.id,
              projectId: activeProject.id,
              isDelete: false,
              story: s,
              isOrderUpdate: false,
              order: undefined,
            },
          ])
        }
      }
      return
    },
    [activeProject, updateStories],
  )

  const getBlockers = useCallback(
    (storyId: string, featureId?: string): (ResolvedRef | InvalidRefError)[] => {
      if (featureId) {
        return featuresById[featureId]?.blockers?.map((d) => resolveDependency(d)) ?? []
      }
      return storiesById[storyId]?.blockers?.map((d) => resolveDependency(d)) ?? []
    },
    [featuresById, storiesById, resolveDependency],
  )

  const getBlockersOutbound = useCallback(
    (id: string): ResolvedRef[] => {
      return blockersOutboundById[id] ?? []
    },
    [blockersOutboundById],
  )

  const value = useMemo<StoriesContextValue>(
    () => ({
      storyIdsByProject,
      storyOrdersByProject,
      storiesById,
      featuresById,
      isProjectLoaded,
      createStory,
      updateStory,
      deleteStory,
      reorderStory,
      getStoryDisplayIndex,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeature,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
      getFeatureDisplayIndex,
    }),
    [
      storyIdsByProject,
      storyOrdersByProject,
      storiesById,
      featuresById,
      isProjectLoaded,
      createStory,
      updateStory,
      deleteStory,
      reorderStory,
      getStoryDisplayIndex,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeature,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
      getFeatureDisplayIndex,
    ],
  )

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>
}

// Create the consumer hook
export function useStories(): StoriesContextValue {
  const ctx = useContext(StoriesContext)
  if (!ctx) throw new Error('useStories must be used within StoriesProvider')
  return ctx
}
