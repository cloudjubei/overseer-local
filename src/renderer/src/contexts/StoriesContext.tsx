import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  InvalidRefError,
  ResolvedFeatureRef,
  ResolvedRef,
  ResolvedStoryRef,
  storiesService,
} from '../services/storiesService'
import { projectsService } from '../services/projectsService'
import { useActiveProject } from './ProjectContext'
import {
  Feature,
  ProjectSpec,
  Story,
  StoryCreateInput,
  StoryEditInput,
  FeatureCreateInput,
  FeatureEditInput,
  ReorderPayload,
  StoryUpdate,
  Status,
} from 'thefactory-tools'

// Define the context value type based on useStories return value
export type StoriesContextValue = {
  storyIdsByProject: Record<string, string[]>
  storiesById: Record<string, Story>
  featuresById: Record<string, Feature>
  createStory: (updates: StoryCreateInput) => Promise<Story | undefined>
  updateStory: (storyId: string, updates: StoryEditInput) => Promise<Story | undefined>
  deleteStory: (storyId: string) => Promise<void>
  addFeature: (storyId: string, updates: FeatureCreateInput) => Promise<Story | undefined>
  updateFeature: (
    storyId: string,
    featureId: string,
    updates: FeatureEditInput,
  ) => Promise<Story | undefined>
  deleteFeature: (storyId: string, featureId: string) => Promise<Story | undefined>
  reorderFeatures: (storyId: string, payload: ReorderPayload) => Promise<Story | undefined>
  reorderStory: (payload: ReorderPayload) => Promise<ProjectSpec | undefined>
  getBlockers: (storyId: string, featureId?: string) => (ResolvedRef | InvalidRefError)[]
  getBlockersOutbound: (id: string) => ResolvedRef[]
  resolveDependency: (dependency: string) => ResolvedRef | InvalidRefError
  normalizeDependency: (dependency: string) => string
}

// Create the context
const StoriesContext = createContext<StoriesContextValue | null>(null)

function isUUID(v: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)
}

function genUUID(): string {
  // Simple RFC4122 v4-like generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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
  project: ProjectSpec | undefined
}

type StateSnapshot = {
  storyIdsByProject: Record<string, string[]>
  storiesById: Record<string, Story>
  featuresById: Record<string, Feature>
  storyDisplayToId: Record<string, string>
  featureDisplayToIdByStory: Record<string, Record<string, string>>
}

export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { project } = useActiveProject()

  const [storyIdsByProject, setStoryIdsByProject] = useState<Record<string, string[]>>({})
  const [storiesById, setStoriesById] = useState<Record<string, Story>>({})
  const [featuresById, setFeaturesById] = useState<Record<string, Feature>>({})
  const [blockersOutboundById, _] = useState<Record<string, ResolvedRef[]>>({})
  const [storyDisplayToId, setStoryDisplayToId] = useState<Record<string, string>>({})
  const [featureDisplayToIdByStory, setFeatureDisplayToIdByStory] = useState<
    Record<string, Record<string, string>>
  >({})

  const takeSnapshot = (): StateSnapshot => ({
    storyIdsByProject: { ...storyIdsByProject },
    storiesById: { ...storiesById },
    featuresById: { ...featuresById },
    storyDisplayToId: { ...storyDisplayToId },
    featureDisplayToIdByStory: { ...featureDisplayToIdByStory },
  })

  const restoreSnapshot = (snap: StateSnapshot) => {
    setStoryIdsByProject(snap.storyIdsByProject)
    setStoriesById(snap.storiesById)
    setFeaturesById(snap.featuresById)
    setStoryDisplayToId(snap.storyDisplayToId)
    setFeatureDisplayToIdByStory(snap.featureDisplayToIdByStory)
  }

  const updateStories = (stories: InternalStoryUpdate[]) => {
    const newStoryIdsByProject: Record<string, string[]> = { ...storyIdsByProject }
    const newStoriesById: Record<string, Story> = { ...storiesById }
    const newFeaturesById: Record<string, Feature> = { ...featuresById }
    const newStoryDisplayToId: Record<string, string> = { ...storyDisplayToId }
    const newFeatureDisplayToIdByStory: Record<string, Record<string, string>> = {
      ...featureDisplayToIdByStory,
    }

    for (const { storyId, projectId, isDelete, story, project } of stories) {
      const currentStoryIds = (newStoryIdsByProject[projectId] ?? []).filter((s) =>
        s !== storyId ? s : undefined,
      )
      if (!isDelete) {
        newStoryIdsByProject[projectId] = [...currentStoryIds, storyId]
      }

      delete newStoriesById[storyId]
      if (!isDelete && story) {
        newStoriesById[storyId] = story!
      }
      if (project) {
        const sDisplay = `${project.storyIdToDisplayIndex[storyId]}`
        delete newStoryDisplayToId[sDisplay]
        if (!isDelete) {
          newStoryDisplayToId[sDisplay] = storyId
        }
      }
      delete newFeatureDisplayToIdByStory[storyId]
      const featureMap: Record<string, string> = {}
      if (story) {
        for (const f of story.features) {
          delete newFeaturesById[f.id]
          if (!isDelete) {
            newFeaturesById[f.id] = f
            const fDisplay = `${story.featureIdToDisplayIndex[f.id]}`
            featureMap[fDisplay] = f.id
          }
        }
      }
      if (!isDelete) {
        newFeatureDisplayToIdByStory[storyId] = featureMap
      }
    }

    setStoryIdsByProject(newStoryIdsByProject)
    setStoriesById(newStoriesById)
    setFeaturesById(newFeaturesById)
    setStoryDisplayToId(newStoryDisplayToId)
    setFeatureDisplayToIdByStory(newFeatureDisplayToIdByStory)
  }

  const onStoryUpdate = useCallback(
    async (storyUpdate: StoryUpdate) => {
      const storyId = storyUpdate.storyId
      const projectId = storyUpdate.projectId
      const isDelete = storyUpdate.type === 'delete'
      const story = storyUpdate.story
      const project = await projectsService.getProject(storyUpdate.projectId)

      updateStories([{ storyId, projectId, isDelete, story, project }])
    },
    [updateStories],
  )
  const update = async () => {
    const projects = await projectsService.listProjects()
    const updates: InternalStoryUpdate[] = []
    for (const project of projects) {
      const projectId = project.id
      try {
        const stories = await storiesService.listStories(projectId)
        for (const story of stories) {
          updates.push({ storyId: story.id, projectId, isDelete: false, story, project })
        }
      } catch (e) {
        console.error('StoriesContext update error: ', e)
      }
    }
    updateStories(updates)
  }
  useEffect(() => {
    const unsubscribe = storiesService.subscribe(onStoryUpdate)
    return () => {
      unsubscribe()
    }
  }, [onStoryUpdate])
  useEffect(() => {
    update()
  }, [])

  const normalizeDependency = useCallback(
    (dependency: string): string => {
      if (!project) return dependency
      return normalizeDependencyInternal(
        storyDisplayToId,
        featureDisplayToIdByStory,
        storiesById,
        dependency,
      )
    },
    [project, storyDisplayToId, featureDisplayToIdByStory, storiesById, featuresById],
  )

  const resolveDependency = useCallback(
    (dependency: string): ResolvedRef | InvalidRefError => {
      if (!project) {
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
      if (parts.length > 1) {
        const feature = featuresById[parts[1]]
        if (!feature) {
          return { id: normalized, code: 'FEATURE_NOT_FOUND', message: "Feature wasn't found" }
        }
        return {
          kind: 'feature',
          id: normalized,
          storyId: parts[0],
          featureId: parts[1],
          story,
          feature,
          display: `${project.storyIdToDisplayIndex[story.id]}.${story.featureIdToDisplayIndex[feature.id]}`,
        } as ResolvedFeatureRef
      }
      return {
        kind: 'story',
        id: normalized,
        storyId: parts[0],
        story,
        display: `${project.storyIdToDisplayIndex[story.id]}`,
      } as ResolvedStoryRef
    },
    [project, storyDisplayToId, featureDisplayToIdByStory, storiesById, featuresById],
  )

  const createStory = useCallback(
    async (updates: StoryCreateInput): Promise<Story | undefined> => {
      if (!project) return
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }

      // Optimistic
      const snap = takeSnapshot()
      const id = genUUID()
      const now = Date.now()
      const optimisticStory: Story = {
        id,
        title: normalized.title,
        status: (normalized.status as Status) ?? '-',
        description: normalized.description ?? '',
        blockers: (normalized.blockers as string[]) ?? [],
        features: [],
        featureIdToDisplayIndex: {},
        createdAt: now,
        updatedAt: now,
      } as any

      const newStoryIdsByProject = { ...storyIdsByProject }
      const list = [...(newStoryIdsByProject[project.id] ?? [])]
      list.push(id)
      newStoryIdsByProject[project.id] = list
      const newStoriesById = { ...storiesById, [id]: optimisticStory }

      // Update display map optimistically
      const newStoryDisplayToId = { ...storyDisplayToId }
      newStoryDisplayToId[String(list.length)] = id

      setStoryIdsByProject(newStoryIdsByProject)
      setStoriesById(newStoriesById)
      setStoryDisplayToId(newStoryDisplayToId)

      try {
        const created = await storiesService.createStory(project.id, normalized)
        // When service returns or subscription arrives, state will be reconciled. If created exists and has different id, we should swap temp id to real id.
        if (created && created.id !== id) {
          // Remove temp and let onStoryUpdate insert real
          const after = takeSnapshot()
          delete after.storiesById[id]
          after.storyIdsByProject[project.id] = after.storyIdsByProject[project.id]?.filter((s) => s !== id) ?? []
          // do not touch display index; on subscription arrival it'll be rebuilt; but ensure we keep UI consistent until then
          restoreSnapshot({
            ...after,
            storyDisplayToId: after.storyDisplayToId,
            featureDisplayToIdByStory: after.featureDisplayToIdByStory,
          })
        }
        return created
      } catch (e) {
        // Rollback
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, normalizeDependency, storyIdsByProject, storiesById, storyDisplayToId],
  )

  const updateStory = useCallback(
    async (storyId: string, updates: StoryEditInput): Promise<Story | undefined> => {
      if (!project) return
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }

      const snap = takeSnapshot()
      const prev = storiesById[storyId]
      if (prev) {
        const next: Story = {
          ...prev,
          ...normalized,
          updatedAt: Date.now(),
        }
        setStoriesById({ ...storiesById, [storyId]: next })
      }

      try {
        const updated = await storiesService.updateStory(project.id, storyId, normalized)
        return updated
      } catch (e) {
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, normalizeDependency, storiesById],
  )

  const deleteStory = useCallback(
    async (storyId: string): Promise<void> => {
      if (!project) return

      const snap = takeSnapshot()

      const newStoriesById = { ...storiesById }
      const story = newStoriesById[storyId]
      delete newStoriesById[storyId]

      const newFeaturesById = { ...featuresById }
      if (story) {
        for (const f of story.features) delete newFeaturesById[f.id]
      }

      const newStoryIdsByProject = { ...storyIdsByProject }
      newStoryIdsByProject[project.id] = (newStoryIdsByProject[project.id] ?? []).filter(
        (id) => id !== storyId,
      )

      const newFeatureDisplayToIdByStory = { ...featureDisplayToIdByStory }
      delete newFeatureDisplayToIdByStory[storyId]

      setStoriesById(newStoriesById)
      setFeaturesById(newFeaturesById)
      setStoryIdsByProject(newStoryIdsByProject)
      setFeatureDisplayToIdByStory(newFeatureDisplayToIdByStory)

      try {
        await storiesService.deleteStory(project.id, storyId)
      } catch (e) {
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, storiesById, featuresById, storyIdsByProject, featureDisplayToIdByStory],
  )

  const addFeature = useCallback(
    async (storyId: string, updates: FeatureCreateInput): Promise<Story | undefined> => {
      if (!project) return
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }

      const snap = takeSnapshot()
      const fId = genUUID()
      const now = Date.now()
      const optimisticFeature: Feature = {
        id: fId,
        title: normalized.title,
        description: normalized.description ?? '',
        rejection: normalized.rejection ?? undefined,
        status: (normalized.status as Status) ?? '-',
        blockers: (normalized.blockers as string[]) ?? [],
        context: (normalized.context as string[]) ?? [],
        createdAt: now,
        updatedAt: now,
      } as any

      const story = storiesById[storyId]
      if (story) {
        const newFeaturesById = { ...featuresById, [fId]: optimisticFeature }
        const newStory: Story = {
          ...story,
          features: [...story.features, optimisticFeature],
          featureIdToDisplayIndex: {
            ...story.featureIdToDisplayIndex,
            [fId]: Object.keys(story.featureIdToDisplayIndex).length + 1,
          },
          updatedAt: now,
        }
        setFeaturesById(newFeaturesById)
        setStoriesById({ ...storiesById, [storyId]: newStory })
      }

      try {
        const s = await storiesService.addFeature(project.id, storyId, normalized)
        return s
      } catch (e) {
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, normalizeDependency, storiesById, featuresById],
  )

  const updateFeature = useCallback(
    async (
      storyId: string,
      featureId: string,
      updates: FeatureEditInput,
    ): Promise<Story | undefined> => {
      if (!project) return
      const normalized: any = { ...updates }
      if (Array.isArray((updates as any).blockers)) {
        normalized.blockers = (updates as any).blockers.map((d: string) => normalizeDependency(d))
      }

      const snap = takeSnapshot()
      const featurePrev = featuresById[featureId]
      if (featurePrev) {
        const nextFeature: Feature = { ...featurePrev, ...normalized, updatedAt: Date.now() }
        const newFeaturesById = { ...featuresById, [featureId]: nextFeature }
        const sPrev = storiesById[storyId]
        if (sPrev) {
          const newStory: Story = {
            ...sPrev,
            features: sPrev.features.map((f) => (f.id === featureId ? nextFeature : f)),
            updatedAt: Date.now(),
          }
          setFeaturesById(newFeaturesById)
          setStoriesById({ ...storiesById, [storyId]: newStory })
        } else {
          setFeaturesById(newFeaturesById)
        }
      }

      try {
        const s = await storiesService.updateFeature(project.id, storyId, featureId, normalized)
        return s
      } catch (e) {
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, normalizeDependency, featuresById, storiesById],
  )

  const deleteFeature = useCallback(
    async (storyId: string, featureId: string): Promise<Story | undefined> => {
      if (!project) return

      const snap = takeSnapshot()
      const sPrev = storiesById[storyId]
      const fPrev = featuresById[featureId]
      if (sPrev && fPrev) {
        const newFeaturesById = { ...featuresById }
        delete newFeaturesById[featureId]
        const newStory: Story = {
          ...sPrev,
          features: sPrev.features.filter((f) => f.id !== featureId),
          updatedAt: Date.now(),
        }
        const newFeatureMap = { ...featureDisplayToIdByStory }
        const fmap = { ...(newFeatureMap[storyId] ?? {}) }
        // Remove display index and shift higher ones
        const removedIndex = sPrev.featureIdToDisplayIndex[featureId]
        if (removedIndex !== undefined) {
          const newIndexMap: Record<string, number> = { ...sPrev.featureIdToDisplayIndex }
          delete (newIndexMap as any)[featureId]
          for (const fid of Object.keys(newIndexMap)) {
            if ((newIndexMap as any)[fid] > removedIndex) {
              ;(newIndexMap as any)[fid] = (newIndexMap as any)[fid] - 1
            }
          }
          ;(newStory as any).featureIdToDisplayIndex = newIndexMap
        }
        // Update reverse map
        for (const key of Object.keys(fmap)) {
          if (fmap[key] === featureId) delete fmap[key]
        }
        newFeatureMap[storyId] = fmap

        setFeaturesById(newFeaturesById)
        setStoriesById({ ...storiesById, [storyId]: newStory })
        setFeatureDisplayToIdByStory(newFeatureMap)
      }

      try {
        const s = await storiesService.deleteFeature(project.id, storyId, featureId)
        return s
      } catch (e) {
        restoreSnapshot(snap)
        throw e
      }
    },
    [project, storiesById, featuresById, featureDisplayToIdByStory],
  )

  const reorderFeatures = useCallback(
    async (storyId: string, payload: ReorderPayload): Promise<Story | undefined> => {
      if (project) {
        return await storiesService.reorderFeatures(project.id, storyId, payload)
      }
      return
    },
    [project],
  )

  const reorderStory = useCallback(
    async (payload: ReorderPayload): Promise<ProjectSpec | undefined> => {
      if (project) {
        const p = await projectsService.reorderStory(project.id, payload)
        return p
      }
      return
    },
    [project],
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
      storiesById,
      featuresById,
      createStory,
      updateStory,
      deleteStory,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeatures,
      reorderStory,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
    }),
    [
      storiesById,
      featuresById,
      createStory,
      updateStory,
      deleteStory,
      addFeature,
      updateFeature,
      deleteFeature,
      reorderFeatures,
      reorderStory,
      getBlockersOutbound,
      getBlockers,
      resolveDependency,
      normalizeDependency,
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
