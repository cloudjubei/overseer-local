import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { gitService } from '../services/gitService'
import { useProjectContext } from './ProjectContext'
import { GitBranchEvent } from 'thefactory-tools'

export type PendingBranch = {
  projectId: string
  repoPath: string
  baseRef: string
  branch: string
  storyId?: string
  featureId?: string
  totals?: { insertions: number; deletions: number; filesChanged: number }
  ahead: number
  behind: number
}

export type ProjectGitStatus = {
  projectId: string
  pending: PendingBranch[]
}

export type MergePreferences = {
  autoPush: boolean
  deleteRemote: boolean
  setAutoPush: (v: boolean) => void
  setDeleteRemote: (v: boolean) => void
}

export type GitContextValue = {
  loading: boolean
  error?: string

  currentProject: ProjectGitStatus
  allProjects: ProjectGitStatus[]

  mergePreferences: MergePreferences
}

const GitContext = createContext<GitContextValue | null>(null)

const getStoryIdFromBranchName = (branchName: string): string | undefined => {
  const match = branchName.match(/^features\/([0-9a-fA-F-]+)/)
  return match ? match[1] : undefined
}

// Local storage helpers for persistent options
const LS_KEYS = {
  autoPush: 'git.merge.autoPush',
  deleteRemote: 'git.merge.deleteRemoteBranch',
}
function readBoolLS(key: string, fallback = false): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === 'true'
  } catch {
    return fallback
  }
}
function writeBoolLS(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? 'true' : 'false')
  } catch {}
}

export function GitProvider({ children }: { children: React.ReactNode }) {
  const { activeProjectId, projects } = useProjectContext()

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [currentProject, setCurrentProject] = useState<ProjectGitStatus>({
    projectId: activeProjectId,
    pending: [],
  })
  const [allProjects, setAllProjects] = useState<ProjectGitStatus[]>([])

  // Merge preferences (persisted)
  const [autoPush, setAutoPush] = useState<boolean>(() => readBoolLS(LS_KEYS.autoPush, false))
  const [deleteRemote, setDeleteRemote] = useState<boolean>(() =>
    readBoolLS(LS_KEYS.deleteRemote, false),
  )
  useEffect(() => writeBoolLS(LS_KEYS.autoPush, autoPush), [autoPush])
  useEffect(() => writeBoolLS(LS_KEYS.deleteRemote, deleteRemote), [deleteRemote])

  const mergePreferences = useMemo<MergePreferences>(
    () => ({ autoPush, deleteRemote, setAutoPush, setDeleteRemote }),
    [autoPush, deleteRemote],
  )

  const onMonitorUpdate = async (update: { projectId: string; state: GitBranchEvent }) => {
    console.log('GitContext onMonitorUpdate update: ', update)
    const { projectId, state: branchUpdate } = update

    setAllProjects((current) => {
      const projectIndex = current.findIndex((p) => p.projectId === projectId)
      if (projectIndex === -1) return current

      const newAllProjects = [...current]
      const newProjectStatus = { ...newAllProjects[projectIndex] }
      newAllProjects[projectIndex] = newProjectStatus

      const newPending = [...newProjectStatus.pending]
      newProjectStatus.pending = newPending

      const branchIdx = newPending.findIndex((b) => b.branch === branchUpdate.name)

      if (branchUpdate.ahead > 0) {
        const pendingBranch: PendingBranch = {
          projectId,
          branch: branchUpdate.name,
          baseRef: 'main', // Assumes the base branch from monitor config
          repoPath: '', // Not available on the event, handled by backend
          ahead: branchUpdate.ahead,
          behind: branchUpdate.behind,
          storyId: getStoryIdFromBranchName(branchUpdate.name),
        }
        if (branchIdx > -1) {
          newPending[branchIdx] = pendingBranch
        } else {
          newPending.push(pendingBranch)
        }
      } else if (branchIdx > -1) {
        newPending.splice(branchIdx, 1)
      }

      return newAllProjects
    })
  }
  useEffect(() => {
    const unsubscribe = gitService.subscribeToMonitorUpdates(onMonitorUpdate)
    return () => {
      unsubscribe()
    }
  }, [onMonitorUpdate])

  useEffect(() => {
    if (loading) return
    setLoading(true)

    setAllProjects(projects.map((p) => ({ projectId: p.id, pending: [] })))
    console.log('Starting gitContext with projects: ', projects)

    const load = async () => {
      try {
        await Promise.all(
          projects.map((p) =>
            gitService.startMonitor(p.id, {
              baseBranch: 'main',
              // branchFilter: (branch) => branch.startsWith('features/'), //TODO: passing this via ipc doesn't work
            }),
          ),
        )
      } catch (e) {
        console.error('GitContext error: ', e)
        setError((e as any)?.message || String(e))
      } finally {
        setLoading(false)
      }
    }

    // load()
  }, [projects])

  useEffect(() => {
    const curr = allProjects.find((p) => p.projectId === activeProjectId) || {
      projectId: activeProjectId,
      pending: [],
    }
    setCurrentProject(curr)
  }, [activeProjectId, allProjects])

  const value = useMemo<GitContextValue>(
    () => ({
      loading,
      error,
      currentProject,
      allProjects,
      mergePreferences,
    }),
    [loading, error, currentProject, allProjects, mergePreferences],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
