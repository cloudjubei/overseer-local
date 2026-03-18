import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitLogCommit } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
import Spinner from '../../../components/ui/Spinner'
import { computeCommitGraph, GraphNode } from './gitCommitGraphUtils'
import GitCommitGraphRow from './GitCommitGraphRow'
import GitCommitGraphHeader from './GitCommitGraphHeader'

export function GitCommitGraph({
  projectId,
  selectedCommitSha,
  uncommittedChanges,
  scrollToSha,
  onSelectCommit,
  onSelectBranchBySha,
}: {
  projectId: string
  selectedCommitSha?: string
  uncommittedChanges?: boolean
  scrollToSha?: string
  onSelectCommit?: (sha: string) => void
  onSelectBranchBySha?: (sha: string) => void
}) {
  const [commits, setCommits] = useState<GitLogCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [colWidths, setColWidths] = useState({
    graph: 140,
    description: 400,
    author: 100,
    commit: 70,
  })

  const rowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const setRowRef = useCallback(
    (sha: string) => (el: HTMLDivElement | null) => {
      if (el) rowRefsMap.current.set(sha, el)
      else rowRefsMap.current.delete(sha)
    },
    [],
  )

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(undefined)
    gitService
      .getGitLog(projectId, { all: true, maxCount: 300 })
      .then((res) => {
        if (!mounted) return
        const isStash = (c: GitLogCommit) =>
          c.refs.some((r) => r.name.includes('stash')) ||
          c.subject.startsWith('WIP on ') ||
          c.subject.startsWith('On ') ||
          c.subject.startsWith('index on ')
        const filtered = res.commits.filter((c) => !isStash(c))
        setCommits(filtered)
        // Auto-select first commit if nothing is selected yet
        if (!selectedCommitSha && onSelectCommit) {
          if (uncommittedChanges) onSelectCommit('UNCOMMITTED')
          else if (filtered.length > 0) onSelectCommit(filtered[0].hash)
        }
      })
      .catch((e) => {
        if (mounted) setError(e.message || 'Failed to load graph')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, uncommittedChanges])

  // Scroll to a sha when the branch selection changes or when commits load
  useEffect(() => {
    if (!scrollToSha) return
    // Give the DOM a tick to render if commits just loaded
    const tryScroll = () => {
      const el = rowRefsMap.current.get(scrollToSha)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    const id = window.setTimeout(tryScroll, 50)
    return () => window.clearTimeout(id)
  }, [scrollToSha, commits])

  const graphNodes = useMemo(() => {
    let nodes = computeCommitGraph(commits)
    if (uncommittedChanges) {
      const stub: GraphNode = {
        commit: {
          hash: 'UNCOMMITTED',
          parents: commits.length > 0 ? [commits[0].hash] : [],
          subject: 'Uncommitted changes',
          authorName: '',
          authorEmail: '',
          authorDate: Date.now(),
          refs: [],
        },
        nodeLane: 0,
        maxLanes: 0,
        incomingLanes: [],
        outgoingLanes: [],
      }
      nodes = [stub, ...nodes]
    }
    return nodes
  }, [commits, uncommittedChanges])

  if (loading && !commits.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-sm text-neutral-500">
        <Spinner />
        <span className="ml-2">Loading commit graph...</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">Error loading graph: {error}</div>
    )
  }
  if (graphNodes.length === 0) {
    return <div className="p-4 text-sm text-neutral-500">No commits found.</div>
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900 relative flex flex-col">
      <div className="min-w-fit min-h-full flex flex-col">
        <div className="flex items-stretch sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-900 shadow-sm border-b border-neutral-200 dark:border-neutral-800">
          <GitCommitGraphHeader
            title="Graph"
            width={colWidths.graph}
            minWidth={50}
            maxWidth={300}
            onResize={(w) => setColWidths((p) => ({ ...p, graph: w }))}
          />
          <GitCommitGraphHeader
            title="Description"
            width={colWidths.description}
            minWidth={100}
            maxWidth={800}
            onResize={(w) => setColWidths((p) => ({ ...p, description: w }))}
          />
          <GitCommitGraphHeader
            title="Author"
            width={colWidths.author}
            minWidth={50}
            maxWidth={200}
            onResize={(w) => setColWidths((p) => ({ ...p, author: w }))}
          />
          <GitCommitGraphHeader
            title="Commit"
            width={colWidths.commit}
            minWidth={50}
            maxWidth={120}
            onResize={(w) => setColWidths((p) => ({ ...p, commit: w }))}
          />
          <GitCommitGraphHeader title="Date" flex1 />
        </div>

        <div className="flex-1">
          {graphNodes.map((node) => {
            const sha = node.commit.hash
            return (
              <GitCommitGraphRow
                key={sha}
                node={node}
                isSelected={selectedCommitSha === sha}
                colWidths={colWidths}
                rowRef={setRowRef(sha)}
                onClick={() => {
                  onSelectCommit?.(sha)
                  if (sha !== 'UNCOMMITTED') onSelectBranchBySha?.(sha)
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
