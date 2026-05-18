import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ingestAll, ingestProject } from '../../generated/backend'
import type { IngestionProgressData } from '../../api/types'
import { useApi } from './ApiContext'

/** Visible state for one in-flight or recently completed ingestion job. */
export type IngestionJobState = {
  jobId: string
  /** `null` for the global `ingestAll` job, otherwise the per-project id. */
  projectId: string | null
  status: 'pending' | 'running' | 'finished' | 'error' | 'partial'
  /** Most recent file index reported via `file` events (1-based). */
  completed: number
  /** Total files announced by the `started` event, or 0 when unknown. */
  total: number
  /** Cumulative documents upserted so far, summed across `batch` events. */
  upserted: number
  /** Last file path seen on a `file` event — useful as a status line. */
  currentFile?: string
  /** Set on terminal `finished` events. */
  result?: { upserted: number; skipped: number; failed: number; durationMs: number }
  /** Set on `error` events; surfaces in the panel as a destructive line. */
  error?: string
  startedAt: number
  finishedAt?: number
}

export type IngestionContextValue = {
  jobs: IngestionJobState[]
  startProjectIngest: (projectId: string) => Promise<string>
  startGlobalIngest: () => Promise<string>
  /** Drops finished / errored entries from the visible list. */
  dismissJob: (jobId: string) => void
}

const IngestionContext = createContext<IngestionContextValue | null>(null)

function isProgressData(v: unknown): v is IngestionProgressData {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Partial<IngestionProgressData>
  return typeof d.jobId === 'string' && typeof d.event === 'object' && d.event !== null
}

export function IngestionProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const [jobsById, setJobsById] = useState<Map<string, IngestionJobState>>(() => new Map())

  useEffect(
    () =>
      ws.on('ingestion:progress', (raw) => {
        if (!isProgressData(raw)) return
        const { jobId, event } = raw
        setJobsById((prev) => {
          const next = new Map(prev)
          const existing = next.get(jobId)
          if (!existing) return prev // ignore broadcasts for jobs we didn't start

          const updated: IngestionJobState = { ...existing }
          switch (event.type) {
            case 'started':
              updated.status = 'running'
              updated.total = event.total
              updated.projectId = event.projectId
              break
            case 'file':
              updated.status = 'running'
              updated.completed = event.index
              updated.total = event.total
              updated.currentFile = event.path
              break
            case 'batch':
              updated.upserted += event.upserted
              break
            case 'finished':
              updated.status = 'finished'
              updated.result = event.result
              updated.finishedAt = Date.now()
              updated.currentFile = undefined
              break
            case 'error':
              updated.status = updated.status === 'running' ? 'partial' : 'error'
              updated.error = event.path ? `${event.path}: ${event.error}` : event.error
              if (updated.status === 'error') updated.finishedAt = Date.now()
              break
          }
          next.set(jobId, updated)
          return next
        })
      }),
    [ws],
  )

  const registerJob = useCallback((jobId: string, projectId: string | null) => {
    setJobsById((prev) => {
      if (prev.has(jobId)) return prev
      const next = new Map(prev)
      next.set(jobId, {
        jobId,
        projectId,
        status: 'pending',
        completed: 0,
        total: 0,
        upserted: 0,
        startedAt: Date.now(),
      })
      return next
    })
  }, [])

  const startProjectIngest = useCallback(
    async (projectId: string) => {
      const { data } = await ingestProject({ path: { projectId }, throwOnError: true })
      registerJob(data.jobId, projectId)
      return data.jobId
    },
    [registerJob],
  )

  const startGlobalIngest = useCallback(async () => {
    const { data } = await ingestAll({ throwOnError: true })
    registerJob(data.jobId, null)
    return data.jobId
  }, [registerJob])

  const dismissJob = useCallback((jobId: string) => {
    setJobsById((prev) => {
      if (!prev.has(jobId)) return prev
      const next = new Map(prev)
      next.delete(jobId)
      return next
    })
  }, [])

  // Stable, newest-first ordering — UI shouldn't have to sort.
  const jobs = useMemo(
    () => Array.from(jobsById.values()).sort((a, b) => b.startedAt - a.startedAt),
    [jobsById],
  )

  const value = useMemo<IngestionContextValue>(
    () => ({ jobs, startProjectIngest, startGlobalIngest, dismissJob }),
    [jobs, startProjectIngest, startGlobalIngest, dismissJob],
  )

  return <IngestionContext.Provider value={value}>{children}</IngestionContext.Provider>
}

export function useIngestion(): IngestionContextValue {
  const ctx = useContext(IngestionContext)
  if (!ctx) throw new Error('useIngestion must be used within IngestionProvider')
  return ctx
}
