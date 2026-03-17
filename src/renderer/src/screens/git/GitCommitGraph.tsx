import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GitLogCommit } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'
import Spinner from '../../components/ui/Spinner'
import { computeCommitGraph, GraphNode } from './graphUtils'

const LANE_COLORS = [
  '#ef4444', // red-500
  '#3b82f6', // blue-500
  '#22c55e', // green-500
  '#f59e0b', // amber-500
  '#a855f7', // purple-500
  '#14b8a6', // teal-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
]

const ROW_HEIGHT = 32
const LANE_WIDTH = 14
const RADIUS = 4

function CommitGraphRow({
  node,
  isSelected,
  onClick,
}: {
  node: GraphNode
  isSelected: boolean
  onClick: () => void
}) {
  const { commit, nodeLane, incomingLanes, outgoingLanes, maxLanes } = node
  const width = Math.max(1, maxLanes + 1) * LANE_WIDTH
  const halfH = ROW_HEIGHT / 2

  const getColor = (laneIndex: number) => LANE_COLORS[laneIndex % LANE_COLORS.length]

  return (
    <div
      className={`flex items-stretch border-b border-neutral-100 dark:border-neutral-800/50 cursor-pointer ${
        isSelected ? 'bg-sky-50 dark:bg-sky-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
      }`}
      style={{ height: ROW_HEIGHT }}
      onClick={onClick}
    >
      {/* The Graph Canvas */}
      <div className="flex-shrink-0" style={{ width, height: ROW_HEIGHT }}>
        <svg width="100%" height="100%">
          {/* Draw incoming lines (top half) */}
          {incomingLanes.map((hash, i) => {
            if (hash === commit.hash) {
              // Line merging into node
              return (
                <path
                  key={`in-${i}`}
                  d={`M ${i * LANE_WIDTH + LANE_WIDTH} 0 Q ${i * LANE_WIDTH + LANE_WIDTH} ${halfH} ${
                    nodeLane * LANE_WIDTH + LANE_WIDTH
                  } ${halfH}`}
                  fill="none"
                  stroke={getColor(i)}
                  strokeWidth="2"
                />
              )
            } else if (hash !== null) {
              // Pass-through line (top half)
              return (
                <line
                  key={`in-${i}`}
                  x1={i * LANE_WIDTH + LANE_WIDTH}
                  y1={0}
                  x2={i * LANE_WIDTH + LANE_WIDTH}
                  y2={halfH}
                  stroke={getColor(i)}
                  strokeWidth="2"
                />
              )
            }
            return null
          })}

          {/* Draw outgoing lines (bottom half) */}
          {outgoingLanes.map((hash, i) => {
            if (hash !== null) {
              const isParentOfNode = commit.parents.includes(hash)
              // If this outgoing lane was spawned or continued from this node
              if (isParentOfNode) {
                // If it's a pass-through that ALSO happens to be a parent, it would be weird but possible.
                // Normally it originates from nodeLane
                return (
                  <path
                    key={`out-${i}`}
                    d={`M ${nodeLane * LANE_WIDTH + LANE_WIDTH} ${halfH} Q ${
                      i * LANE_WIDTH + LANE_WIDTH
                    } ${halfH} ${i * LANE_WIDTH + LANE_WIDTH} ${ROW_HEIGHT}`}
                    fill="none"
                    stroke={getColor(i)}
                    strokeWidth="2"
                  />
                )
              } else {
                // Pass-through line (bottom half)
                // wait, if it's a pass-through, we just connect it from halfH to bottom
                return (
                  <line
                    key={`out-${i}`}
                    x1={i * LANE_WIDTH + LANE_WIDTH}
                    y1={halfH}
                    x2={i * LANE_WIDTH + LANE_WIDTH}
                    y2={ROW_HEIGHT}
                    stroke={getColor(i)}
                    strokeWidth="2"
                  />
                )
              }
            }
            return null
          })}

          {/* Draw the commit dot */}
          <circle
            cx={nodeLane * LANE_WIDTH + LANE_WIDTH}
            cy={halfH}
            r={RADIUS}
            fill={getColor(nodeLane)}
            stroke="#fff"
            strokeWidth="2"
            className="dark:stroke-neutral-900"
          />
        </svg>
      </div>

      {/* Commit Info */}
      <div className="flex-1 min-w-0 flex items-center px-2 text-xs gap-3">
        <div className="w-16 flex-shrink-0 text-neutral-500 font-mono text-[10px]">
          {commit.hash.substring(0, 7)}
        </div>
        <div className="flex-1 min-w-0 truncate text-neutral-800 dark:text-neutral-200">
          {commit.refs.length > 0 && (
            <span className="inline-flex gap-1 mr-2">
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
        <div className="w-24 flex-shrink-0 truncate text-neutral-500 text-[10px]">
          {commit.authorName}
        </div>
        <div className="w-20 flex-shrink-0 text-right text-neutral-400 text-[10px]">
          {new Date(commit.authorDate).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      </div>
    </div>
  )
}

export function GitCommitGraph({
  projectId,
  selectedCommitSha,
  onSelectCommit,
}: {
  projectId: string
  selectedCommitSha?: string
  onSelectCommit?: (sha: string) => void
}) {
  const [commits, setCommits] = useState<GitLogCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(undefined)

    gitService
      .getGitLog(projectId, { all: true, maxCount: 300 })
      .then((res) => {
        if (mounted) setCommits(res.commits)
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
  }, [projectId])

  const graphNodes = useMemo(() => computeCommitGraph(commits), [commits])

  if (loading && !commits.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-sm text-neutral-500">
        <Spinner /> <span className="ml-2">Loading commit graph...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600 dark:text-red-400">
        Error loading graph: {error}
      </div>
    )
  }

  if (graphNodes.length === 0) {
    return <div className="p-4 text-sm text-neutral-500">No commits found.</div>
  }

  return (
    <div className="flex-1 overflow-auto bg-white dark:bg-neutral-900 relative">
      <div className="min-w-[600px]">
        {graphNodes.map((node) => (
          <CommitGraphRow
            key={node.commit.hash}
            node={node}
            isSelected={selectedCommitSha === node.commit.hash}
            onClick={() => onSelectCommit?.(node.commit.hash)}
          />
        ))}
      </div>
    </div>
  )
}
