import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createEntity,
  deleteEntities,
  deleteEntity,
  listEntities,
  updateEntity,
  type Entity,
  type EntityInput,
  type EntityPatch,
} from 'thefactory-ui/headless/api'
import { useApi } from './ApiContext'
import { useActiveProject } from './ProjectsContext'

export type EntitiesContextValue = {
  isLoaded: boolean
  loadError: Error | null
  entities: Entity[]
  createEntity: (input: Omit<EntityInput, 'projectId'>) => Promise<Entity>
  updateEntity: (id: string, patch: EntityPatch) => Promise<Entity>
  deleteEntity: (id: string) => Promise<void>
  /**
   * Drops entities belonging to the active project. Pass `types` to scope the
   * delete to one or more types; otherwise every entity in the project is
   * removed.
   */
  clearProjectEntities: (opts?: { types?: string[] }) => Promise<void>
  refresh: () => Promise<void>
}

const EntitiesContext = createContext<EntitiesContextValue | null>(null)

const EMPTY_ENTITIES: Entity[] = []

export function EntitiesProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { projectId } = useActiveProject()

  const [entities, setEntities] = useState<Entity[]>(EMPTY_ENTITIES)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!projectId) {
      setEntities(EMPTY_ENTITIES)
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      const { data } = await listEntities({
        query: { projectIds: projectId },
        throwOnError: true,
      })
      setEntities(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [projectId])

  useEffect(() => {
    setIsLoaded(false)
    setEntities(EMPTY_ENTITIES)
    setLoadError(null)
    void refresh()
  }, [projectId, refresh])

  useEffect(() => ws.on('entities:updated', () => void refresh()), [ws, refresh])

  const requireProject = useCallback(() => {
    if (!projectId) throw new Error('No active project — cannot mutate entities')
    return projectId
  }, [projectId])

  const createEntityImpl = useCallback(
    async (input: Omit<EntityInput, 'projectId'>) => {
      const { data } = await createEntity({
        body: { ...input, projectId: requireProject() },
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const updateEntityImpl = useCallback(
    async (id: string, patch: EntityPatch) => {
      const { data } = await updateEntity({
        path: { id },
        body: patch,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [refresh],
  )

  const deleteEntityImpl = useCallback(
    async (id: string) => {
      await deleteEntity({ path: { id }, throwOnError: true })
      await refresh()
    },
    [refresh],
  )

  const clearProjectEntities = useCallback(
    async (opts?: { types?: string[] }) => {
      const types = opts?.types?.filter((t) => t.trim().length > 0)
      await deleteEntities({
        query: {
          projectIds: requireProject(),
          ...(types && types.length > 0 ? { types: types.join(',') } : {}),
        },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh],
  )

  const value = useMemo<EntitiesContextValue>(
    () => ({
      isLoaded,
      loadError,
      entities,
      createEntity: createEntityImpl,
      updateEntity: updateEntityImpl,
      deleteEntity: deleteEntityImpl,
      clearProjectEntities,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      entities,
      createEntityImpl,
      updateEntityImpl,
      deleteEntityImpl,
      clearProjectEntities,
      refresh,
    ],
  )

  return <EntitiesContext.Provider value={value}>{children}</EntitiesContext.Provider>
}

export function useEntities(): EntitiesContextValue {
  const ctx = useContext(EntitiesContext)
  if (!ctx) throw new Error('useEntities must be used within EntitiesProvider')
  return ctx
}
