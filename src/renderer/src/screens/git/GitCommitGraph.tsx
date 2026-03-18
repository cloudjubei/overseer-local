import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GitLogCommit } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
import Spinner from '../../components/ui/Spinner'
import { computeCommitGraph, GraphNode } from './graphUtils'

const LANE_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b',
  '#a855f7', '#14b8a6', '#ec4899', '#6366f1',
]
const ROW_HEIGHT = 32
const LANE_WIDTH = 14
const RADIUS = 4

// ─── Single row ───────────────────────────────────────────────────────────────
function CommitGraphRow({
  node,
  isSelected,
  onClick,
  colWidths,
  rowRef,
}: {
  node: GraphNode
  isSelected: boolean
  onClick: () => void
  colWidths: { graph: number; description: number; author: number; commit: number }
  rowRef?: (el: HTMLDivElement | null) => void
}) {
  const { commit, nodeLane, incomingLanes, outgoingLanes } = node
  const halfH = ROW_HEIGHT / 2
  const getColor = (i: number) => LANE_COLORS[i % LANE_COLORS.length]
  const isUncommitted = commit.hash === 'UNCOMMITTED'

  return (
    <div
      ref={rowRef}
      className={`flex items-stretch border-b border-neutral-100 dark:border-neutral-800/50 cursor-pointer ${
        isSelected ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
      }`}
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      {/* Graph canvas */}
      <div className="flex-shrink-0" style={{ width: colWidths.graph, height: ROW_HEIGHT }}>
        {!isUncommitted && (
          <svg width="100%" height="100%">
            {incomingLanes.map((hash, i) => {
              if (hash === commit.hash) {
                return (
                  <path
                    key={`in-${i}`}
                    d={`M ${i * LANE_WIDTH + LANE_WIDTH} 0 Q ${i * LANE_WIDTH + LANE_WIDTH} ${halfH} ${
                      nodeLane * LANE_WIDTH + LANE_WIDTH
                    } ${halfH}`}
                    fill="none" stroke={getColor(i)} strokeWidth="2"
                  />
                )
              } else if (hash !== null) {
                return (
                  <line
                    key={`in-${i}`}
                    x1={i * LANE_WIDTH + LANE_WIDTH} y1={0}
                    x2={i * LANE_WIDTH + LANE_WIDTH} y2={halfH}
                    stroke={getColor(i)} strokeWidth="2"
                  />
                )
              }
              return null
            })}

            {outgoingLanes.map((hash, i) => {
              if (hash !== null) {
                const isParent = commit.parents.includes(hash)
                if (isParent) {
                  return (
                    <path
                      key={`out-${i}`}
                      d={`M ${nodeLane * LANE_WIDTH + LANE_WIDTH} ${halfH} Q ${
                        i * LANE_WIDTH + LANE_WIDTH
                      } ${halfH} ${i * LANE_WIDTH + LANE_WIDTH} ${ROW_HEIGHT}`}
                      fill="none" stroke={getColor(i)} strokeWidth="2"
                    />
                  )
                }
                return (
                  <line
                    key={`out-${i}`}
                    x1={i * LANE_WIDTH + LANE_WIDTH} y1={halfH}
                    x2={i * LANE_WIDTH + LANE_WIDTH} y2={ROW_HEIGHT}
                    stroke={getColor(i)} strokeWidth="2"
                  />
                )
              }
              return null
            })}

            <circle
              cx={nodeLane * LANE_WIDTH + LANE_WIDTH} cy={halfH}
              r={RADIUS} fill={getColor(nodeLane)}
              stroke="#fff" strokeWidth="2"
              className="dark:stroke-neutral-900"
            />
          </svg>
        )}
      </div>

      {/* Commit info */}
      <div className="flex-1 min-w-0 flex items-center px-2 text-xs gap-3">
        {isUncommitted ? (
          <div className="flex-1 italic font-semibold text-neutral-600 dark:text-neutral-400">
            Uncommitted changes
          </div>
        ) : (
          <>
            <div
              className="flex-shrink-0 min-w-0 truncate text-neutral-800 dark:text-neutral-200 pr-2"
              style={{ width: colWidths.description }}
            >
              {commit.refs && commit.refs.length > 0 && (
                <span className="inline-flex gap-1 mr-2 flex-wrap">
                  {commit.refs.map((r, idx) => (
                    <span
                      key={idx}
                      className={`px-1 rounded text-[9px] uppercase tracking-wider ${
                        r.type === 'HEAD'
                          ? 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:border-sky-800'
                          : r.type === 'branch'
                            ? 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800'
                            : r.type === 'remote'
                              ? 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800'
                              : 'bg-neutral-100 text-neutral-800 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700'
                      }`}
                    >
                      {r.name}
                    </span>
                  ))}
                </span>
              )}
              {commit.subject}
            </div>
            <div className="flex-shrink-0 truncate text-neutral-500 text-[10px]" style={{ width: colWidths.author }}>
              {commit.authorName}
            </div>
            <div className="flex-shrink-0 text-neutral-500 font-mono text-[10px]" style={{ width: colWidths.commit }}>
              {commit.hash.substring(0, 7)}
            </div>
            <div className="flex-1 min-w-0 text-right text-neutral-400 text-[10px] truncate">
              {new Date(commit.authorDate).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Resizable column header ──────────────────────────────────────────────────
function ResizableHeader({
  title, width, minWidth = 50, maxWidth = 500, onResize, flex1,
}: {
  title: string
  width?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (w: number) => void
  flex1?: boolean
}) {
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onResize || !width) return
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) =>
      onResize(Math.max(minWidth, Math.min(maxWidth, startW + ev.clientX - startX)))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className={`relative px-2 py-1 flex items-center border-r border-neutral-200 dark:border-neutral-800
        text-xs font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800/50
        ${flex1 ? 'flex-1 min-w-0' : 'flex-shrink-0'}`}
      style={!flex1 && width ? { width } : undefined}
    >
      <span className="truncate">{title}</span>
      {!flex1 && onResize && (
        <div
          onPointerDown={handlePointerDown}
          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-sky-500/50"
          style={{ right: -1, zIndex: 10 }}
        />
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
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
  /**
   * When this value changes the graph scrolls to the row with that SHA.
   * Passed from the parent when the user selects a branch in the sidebar.
   */
  scrollToSha?: string
  onSelectCommit?: (sha: string) => void
  /**
   * Fired when a commit row is clicked so the parent can reflect which branch
   * tip matches this sha (prefers local, falls back to remote).
   */
  onSelectBranchBySha?: (sha: string) => void
}) {
  const [commits, setCommits] = useState<GitLogCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [colWidths, setColWidths] = useState({ graph: 140, description: 400, author: 100, commit: 70 })

  // sha → DOM element for scroll-to
  const rowRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())

  const setRowRef = useCallback(
    (sha: string) => (el: HTMLDivElement | null) => {
      if (el) rowRefsMap.current.set(sha, el)
      else rowRefsMap.current.delete(sha)
    },
    [],
  )

  // Load commits
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
      .catch((e) => { if (mounted) setError(e.message || 'Failed to load graph') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
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
          authorName: '', authorEmail: '', authorDate: Date.now(), refs: [],
        },
        nodeLane: 0, maxLanes: 0, incomingLanes: [], outgoingLanes: [],
      }
      nodes = [stub, ...nodes]
    }
    return nodes
  }, [commits, uncommittedChanges])

  if (loading && !commits.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-sm text-neutral-500">
        <Spinner /><span className="ml-2">Loading commit graph...</span>
      </div>
    )
  }
  if (error) {
    return <div className="p-4 text-sm text-red-600 dark:text-red-400">Error loading graph: {error}</div>
  }
  if (graphNodes.length === 0) {
    return <div className="p-4 text-sm text-neutral-500">No commits found.</div>
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900 relative flex flex-col">
      <div className="min-w-fit min-h-full flex flex-col">
        {/* Header */}
        <div className="flex items-stretch sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-900 shadow-sm border-b border-neutral-200 dark:border-neutral-800">
          <ResizableHeader title="Graph" width={colWidths.graph} minWidth={50} maxWidth={300} onResize={(w) => setColWidths((p) => ({ ...p, graph: w }))} />
          <ResizableHeader title="Description" width={colWidths.description} minWidth={100} maxWidth={800} onResize={(w) => setColWidths((p) => ({ ...p, description: w }))} />
          <ResizableHeader title="Author" width={colWidths.author} minWidth={50} maxWidth={200} onResize={(w) => setColWidths((p) => ({ ...p, author: w }))} />
          <ResizableHeader title="Commit" width={colWidths.commit} minWidth={50} maxWidth={120} onResize={(w) => setColWidths((p) => ({ ...p, commit: w }))} />
          <ResizableHeader title="Date" flex1 />
        </div>

        <div className="flex-1">
          {graphNodes.map((node) => {
            const sha = node.commit.hash
            return (
              <CommitGraphRow
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
