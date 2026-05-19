import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  createGitBranch,
  deleteFiles,
  deleteGitBranch,
  getGitFileContent,
  getGitLocalDiff,
  getGitLog,
  getGitStatus,
  gitApplyPatch,
  gitResetAll,
  gitCheckout,
  gitCommit,
  gitFetch,
  gitMergeApply,
  gitMergePlan,
  gitMergeReport,
  gitPull,
  gitPush,
  gitReset,
  gitStage,
  gitStash,
  gitStashApply,
  gitStashDrop,
  gitUnstage,
  listGitStashes,
  listUnifiedGitBranches,
  unwrapGitEnvelope,
} from 'thefactory-ui/headless/api'
import type {
  GitCommitResponse,
  GitFetchResponse,
  GitFileChange,
  GitMergeApplyInput,
  GitMergePlan,
  GitMergePlanInput,
  GitMergeReport,
  GitMergeReportInput,
  GitMergeResult,
  GitPullResponse,
  GitPushResponse,
  GitStashResponse,
  GitLogCommit,
  GitStashListItem,
  CommitInput,
  CreateBranchInput,
  FetchInput,
  GitStatus,
  GitUnifiedBranch,
  PullInput,
  PushInput,
  StashApplyInput,
  StashDropInput,
  StashInput,
} from 'thefactory-ui/headless/api'
import { useApi } from './ApiContext'
import { useActiveProject } from './ProjectsContext'

export type GitSelection =
  | { kind: 'branch'; branchName: string }
  | { kind: 'stash'; stashRef: string }
  | { kind: 'commit'; sha: string }
  | null

export type LocalDiffEntry = GitFileChange & { isConflicted?: boolean }

export type LocalDiff = {
  staged: LocalDiffEntry[]
  unstaged: LocalDiffEntry[]
  conflicts: string[]
}

export type MergePreferences = {
  autoPush: boolean
  deleteRemoteAfterMerge: boolean
}

export type GitContextValue = {
  isLoaded: boolean
  loadError: Error | null

  status: GitStatus | null
  branches: GitUnifiedBranch[]
  log: GitLogCommit[]
  /** True when there's likely more history beyond the currently loaded `log`. */
  hasMoreLog: boolean
  isLogLoading: boolean
  /** Fetch the next page and append. Idempotent while a fetch is in flight. */
  loadMoreLog: () => Promise<void>
  stashes: GitStashListItem[]

  /** Working tree split into staged + unstaged, with conflict marks. */
  localDiff: LocalDiff | null
  isLocalDiffLoading: boolean
  loadLocalDiff: () => Promise<void>

  /**
   * Selection across views — branch / stash / commit. Lifted here so per-view
   * components stay in sync (e.g. the graph and the diff pane).
   */
  selection: GitSelection
  setSelection: (sel: GitSelection) => void

  /** Persisted merge preferences, mirrored from desktop. */
  mergePreferences: MergePreferences
  setMergePreferences: (next: Partial<MergePreferences>) => void

  commit: (input: CommitInput) => Promise<GitCommitResponse>
  push: (input?: PushInput) => Promise<GitPushResponse>
  pull: (input?: PullInput) => Promise<GitPullResponse>
  fetch: (input?: FetchInput) => Promise<GitFetchResponse>
  getFileContent: (path: string, ref: string) => Promise<string>
  resetAll: () => Promise<void>

  stage: (paths: string[]) => Promise<void>
  unstage: (paths: string[]) => Promise<void>
  reset: (paths: string[]) => Promise<void>
  /** `git rm` equivalent — drops working-tree files via the files API. */
  removeFiles: (paths: string[]) => Promise<void>
  /**
   * Apply a raw unified diff patch via `git apply`. Used by the diff viewer
   * to stage/unstage/discard individual hunks. `cached: true` writes the
   * patch to the index only; `reverse: true` flips additions and deletions.
   */
  applyPatch: (input: {
    patch: string
    cached?: boolean
    reverse?: boolean
    index?: boolean
  }) => Promise<void>

  checkout: (branch: string) => Promise<void>
  createBranch: (input: CreateBranchInput) => Promise<void>
  deleteBranch: (name: string) => Promise<void>

  stash: (input?: StashInput) => Promise<GitStashResponse>
  applyStash: (input: StashApplyInput) => Promise<void>
  dropStash: (input: StashDropInput) => Promise<void>

  planMerge: (input: GitMergePlanInput) => Promise<GitMergePlan>
  buildMergeReport: (input: GitMergeReportInput) => Promise<GitMergeReport>
  applyMerge: (input: GitMergeApplyInput) => Promise<GitMergeResult>

  refresh: () => Promise<void>
}

const GitContext = createContext<GitContextValue | null>(null)

const EMPTY_BRANCHES: GitUnifiedBranch[] = []
const EMPTY_LOG: GitLogCommit[] = []
const EMPTY_STASHES: GitStashListItem[] = []
const EMPTY_STATUS: GitStatus = { staged: [], unstaged: [], untracked: [] }

// Page size for commit log fetches. Larger initial page so most branch tips
// land in the first batch; subsequent pages append on scroll. `all: true`
// includes non-current branches so we can scroll to any branch's tip.
const LOG_PAGE_SIZE = 300

const DEFAULT_MERGE_PREFS: MergePreferences = {
  autoPush: false,
  deleteRemoteAfterMerge: false,
}

const MERGE_PREFS_KEY_PREFIX = 'git.mergePrefs:'

function readMergePrefs(projectId: string | undefined): MergePreferences {
  if (!projectId || typeof window === 'undefined') return DEFAULT_MERGE_PREFS
  try {
    const raw = window.localStorage.getItem(`${MERGE_PREFS_KEY_PREFIX}${projectId}`)
    if (!raw) return DEFAULT_MERGE_PREFS
    const parsed = JSON.parse(raw)
    return {
      autoPush: !!parsed?.autoPush,
      deleteRemoteAfterMerge: !!parsed?.deleteRemoteAfterMerge,
    }
  } catch {
    return DEFAULT_MERGE_PREFS
  }
}

function persistMergePrefs(projectId: string | undefined, prefs: MergePreferences) {
  if (!projectId || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(`${MERGE_PREFS_KEY_PREFIX}${projectId}`, JSON.stringify(prefs))
  } catch {
    // private mode etc. — best-effort, never block on storage failure
  }
}

export function GitProvider({ children }: { children: ReactNode }) {
  const { ws } = useApi()
  const { projectId } = useActiveProject()

  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<GitUnifiedBranch[]>(EMPTY_BRANCHES)
  const [log, setLog] = useState<GitLogCommit[]>(EMPTY_LOG)
  const [hasMoreLog, setHasMoreLog] = useState(true)
  const [isLogLoading, setIsLogLoading] = useState(false)
  const logFetchRef = useRef(false)
  const [stashes, setStashes] = useState<GitStashListItem[]>(EMPTY_STASHES)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<Error | null>(null)

  const [localDiff, setLocalDiff] = useState<LocalDiff | null>(null)
  const [isLocalDiffLoading, setIsLocalDiffLoading] = useState(false)
  const localDiffAbortRef = useRef<AbortController | null>(null)
  const localDiffLoadedRef = useRef(false)

  const [selection, setSelectionState] = useState<GitSelection>(null)
  const [mergePreferences, setMergePreferencesState] = useState<MergePreferences>(() =>
    readMergePrefs(projectId),
  )

  // Resync mergePrefs whenever the project changes.
  useEffect(() => {
    setMergePreferencesState(readMergePrefs(projectId))
  }, [projectId])

  const setMergePreferences = useCallback(
    (next: Partial<MergePreferences>) => {
      setMergePreferencesState((prev) => {
        const merged = { ...prev, ...next }
        persistMergePrefs(projectId, merged)
        return merged
      })
    },
    [projectId],
  )

  const setSelection = useCallback((sel: GitSelection) => {
    setSelectionState(sel)
  }, [])

  const refresh = useCallback(async () => {
    if (!projectId) {
      setStatus(null)
      setBranches(EMPTY_BRANCHES)
      setLog(EMPTY_LOG)
      setHasMoreLog(true)
      setStashes(EMPTY_STASHES)
      setIsLoaded(true)
      setLoadError(null)
      return
    }
    try {
      const path = { projectId }
      const [statusRes, branchesRes, logRes, stashesRes] = await Promise.all([
        getGitStatus({ path, throwOnError: true }),
        listUnifiedGitBranches({ path, throwOnError: true }),
        getGitLog({
          path,
          query: { all: true, maxCount: LOG_PAGE_SIZE },
          throwOnError: true,
        }),
        listGitStashes({ path, throwOnError: true }),
      ])
      setStatus(unwrapGitEnvelope(statusRes.data, 'status', EMPTY_STATUS))
      setBranches(unwrapGitEnvelope(branchesRes.data, 'branches', EMPTY_BRANCHES))
      const commits = logRes.data.commits
      setLog(commits)
      setHasMoreLog(commits.length >= LOG_PAGE_SIZE)
      setStashes(unwrapGitEnvelope(stashesRes.data, 'stashes', EMPTY_STASHES))
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setIsLoaded(true)
    }
  }, [projectId])

  const loadMoreLog = useCallback(async () => {
    if (!projectId) return
    if (logFetchRef.current) return
    if (!hasMoreLog) return
    logFetchRef.current = true
    setIsLogLoading(true)
    try {
      const { data } = await getGitLog({
        path: { projectId },
        query: { all: true, maxCount: LOG_PAGE_SIZE, skip: log.length },
        throwOnError: true,
      })
      const next = data.commits
      if (next.length === 0) {
        setHasMoreLog(false)
        return
      }
      // Dedupe in case the backend returned overlapping commits (defensive
      // — `skip` should already avoid this).
      setLog((prev) => {
        const seen = new Set(prev.map((c) => c.hash))
        const merged = [...prev]
        for (const c of next) {
          if (!seen.has(c.hash)) merged.push(c)
        }
        return merged
      })
      setHasMoreLog(next.length >= LOG_PAGE_SIZE)
    } catch (err) {
      // Pagination failures shouldn't blank the existing log; log them.
      console.warn('[GitContext] loadMoreLog failed', err)
      setHasMoreLog(false)
    } finally {
      logFetchRef.current = false
      setIsLogLoading(false)
    }
  }, [projectId, hasMoreLog, log])

  useEffect(() => {
    localDiffAbortRef.current?.abort()
    localDiffLoadedRef.current = false
    logFetchRef.current = false
    setIsLoaded(false)
    setStatus(null)
    setBranches(EMPTY_BRANCHES)
    setLog(EMPTY_LOG)
    setHasMoreLog(true)
    setIsLogLoading(false)
    setStashes(EMPTY_STASHES)
    setLocalDiff(null)
    setSelectionState(null)
    setLoadError(null)
    void refresh()
  }, [projectId, refresh])

  const requireProject = useCallback(() => {
    if (!projectId) throw new Error('No active project — cannot perform git operation')
    return projectId
  }, [projectId])

  const loadLocalDiff = useCallback(async () => {
    const id = requireProject()
    localDiffAbortRef.current?.abort()
    const controller = new AbortController()
    localDiffAbortRef.current = controller
    setIsLocalDiffLoading(true)
    try {
      const [stagedRes, unstagedRes] = await Promise.all([
        getGitLocalDiff({
          path: { projectId: id },
          body: { staged: true, includePatch: true, includeStructured: true },
          signal: controller.signal,
          throwOnError: true,
        }),
        getGitLocalDiff({
          path: { projectId: id },
          body: { staged: false, includePatch: true, includeStructured: true },
          signal: controller.signal,
          throwOnError: true,
        }),
      ])
      if (controller.signal.aborted) return
      const stagedFiles: GitFileChange[] = stagedRes.data
      const unstagedFiles: GitFileChange[] = unstagedRes.data
      const conflictedSet = new Set<string>(
        [...stagedFiles, ...unstagedFiles]
          .filter((f) => f.status === 'U')
          .map((f) => f.path)
          .filter((p): p is string => typeof p === 'string' && p.length > 0),
      )
      const decorate = (f: GitFileChange): LocalDiffEntry => ({
        ...f,
        isConflicted: conflictedSet.has(f.path),
      })
      setLocalDiff({
        staged: stagedFiles.map(decorate),
        unstaged: unstagedFiles.map(decorate),
        conflicts: Array.from(conflictedSet),
      })
      localDiffLoadedRef.current = true
    } catch (err) {
      if (controller.signal.aborted) return
      throw err
    } finally {
      if (localDiffAbortRef.current === controller) {
        localDiffAbortRef.current = null
        setIsLocalDiffLoading(false)
      }
    }
  }, [requireProject])

  // Re-fetch on backend mutation. localDiff piggybacks only when previously
  // loaded so a tab that doesn't show it doesn't pay the round-trip cost.
  useEffect(
    () =>
      ws.on('git:status-changed', () => {
        void refresh()
        if (localDiffLoadedRef.current) void loadLocalDiff()
      }),
    [ws, refresh, loadLocalDiff],
  )

  const commit = useCallback(
    async (input: CommitInput) => {
      const id = requireProject()
      const { data } = await gitCommit({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const push = useCallback(
    async (input: PushInput = {}) => {
      const id = requireProject()
      const { data } = await gitPush({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const pull = useCallback(
    async (input: PullInput = {}) => {
      const id = requireProject()
      const { data } = await gitPull({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const fetchOp = useCallback(
    async (input: FetchInput = {}) => {
      const id = requireProject()
      const { data } = await gitFetch({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const getFileContent = useCallback(
    async (path: string, ref: string) => {
      const id = requireProject()
      const { data } = await getGitFileContent({
        path: { projectId: id },
        body: { path, ref },
        throwOnError: true,
      })
      return data.content
    },
    [requireProject],
  )

  const resetAll = useCallback(async () => {
    const id = requireProject()
    await gitResetAll({ path: { projectId: id }, throwOnError: true })
    await refresh()
  }, [requireProject, refresh])

  const stage = useCallback(
    async (paths: string[]) => {
      const id = requireProject()
      await gitStage({ path: { projectId: id }, body: { paths }, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const unstage = useCallback(
    async (paths: string[]) => {
      const id = requireProject()
      await gitUnstage({ path: { projectId: id }, body: { paths }, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const reset = useCallback(
    async (paths: string[]) => {
      const id = requireProject()
      await gitReset({ path: { projectId: id }, body: { paths }, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const removeFiles = useCallback(
    async (paths: string[]) => {
      const id = requireProject()
      if (paths.length === 0) return
      await deleteFiles({ path: { projectId: id }, body: { paths }, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const applyPatch = useCallback(
    async (input: { patch: string; cached?: boolean; reverse?: boolean; index?: boolean }) => {
      const id = requireProject()
      await gitApplyPatch({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      // Don't wait on the WS `git:status-changed` round-trip — if `localDiff`
      // was loaded, refetch it inline so the file row's "modified" badge
      // and the diff pane both reflect the new index state immediately.
      if (localDiffLoadedRef.current) {
        await loadLocalDiff()
      }
    },
    [requireProject, refresh, loadLocalDiff],
  )

  const checkout = useCallback(
    async (branch: string) => {
      const id = requireProject()
      await gitCheckout({ path: { projectId: id }, body: { branch }, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const createBranch = useCallback(
    async (input: CreateBranchInput) => {
      const id = requireProject()
      await createGitBranch({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const deleteBranch = useCallback(
    async (name: string) => {
      const id = requireProject()
      await deleteGitBranch({
        path: { projectId: id },
        body: { name },
        throwOnError: true,
      })
      await refresh()
    },
    [requireProject, refresh],
  )

  const stash = useCallback(
    async (input: StashInput = {}) => {
      const id = requireProject()
      const { data } = await gitStash({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const applyStash = useCallback(
    async (input: StashApplyInput) => {
      const id = requireProject()
      await gitStashApply({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const dropStash = useCallback(
    async (input: StashDropInput) => {
      const id = requireProject()
      await gitStashDrop({ path: { projectId: id }, body: input, throwOnError: true })
      await refresh()
    },
    [requireProject, refresh],
  )

  const planMerge = useCallback(
    async (input: GitMergePlanInput) => {
      const id = requireProject()
      const { data } = await gitMergePlan({
        path: { projectId: id },
        body: input,
        throwOnError: true,
      })
      return data
    },
    [requireProject],
  )

  const buildMergeReport = useCallback(
    async (input: GitMergeReportInput) => {
      const id = requireProject()
      const { data } = await gitMergeReport({
        path: { projectId: id },
        body: input,
        throwOnError: true,
      })
      return data
    },
    [requireProject],
  )

  const applyMerge = useCallback(
    async (input: GitMergeApplyInput) => {
      const id = requireProject()
      const { data } = await gitMergeApply({
        path: { projectId: id },
        body: input,
        throwOnError: true,
      })
      await refresh()
      return data
    },
    [requireProject, refresh],
  )

  const value = useMemo<GitContextValue>(
    () => ({
      isLoaded,
      loadError,
      status,
      branches,
      log,
      hasMoreLog,
      isLogLoading,
      loadMoreLog,
      stashes,
      localDiff,
      isLocalDiffLoading,
      loadLocalDiff,
      selection,
      setSelection,
      mergePreferences,
      setMergePreferences,
      commit,
      push,
      pull,
      fetch: fetchOp,
      getFileContent,
      resetAll,
      stage,
      unstage,
      reset,
      removeFiles,
      applyPatch,
      checkout,
      createBranch,
      deleteBranch,
      stash,
      applyStash,
      dropStash,
      planMerge,
      buildMergeReport,
      applyMerge,
      refresh,
    }),
    [
      isLoaded,
      loadError,
      status,
      branches,
      log,
      hasMoreLog,
      isLogLoading,
      loadMoreLog,
      stashes,
      localDiff,
      isLocalDiffLoading,
      loadLocalDiff,
      selection,
      setSelection,
      mergePreferences,
      setMergePreferences,
      commit,
      push,
      pull,
      fetchOp,
      getFileContent,
      resetAll,
      stage,
      unstage,
      reset,
      removeFiles,
      applyPatch,
      checkout,
      createBranch,
      deleteBranch,
      stash,
      applyStash,
      dropStash,
      planMerge,
      buildMergeReport,
      applyMerge,
      refresh,
    ],
  )

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>
}

export function useGit(): GitContextValue {
  const ctx = useContext(GitContext)
  if (!ctx) throw new Error('useGit must be used within GitProvider')
  return ctx
}
