import { GraphNode } from './gitCommitGraphUtils'

const LANE_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#6366f1',
]
const ROW_HEIGHT = 32
const LANE_WIDTH = 14
const RADIUS = 4

export default function GitCommitGraphRow({
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
        isSelected
          ? 'bg-sky-50 dark:bg-sky-900/20'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
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
                    fill="none"
                    stroke={getColor(i)}
                    strokeWidth="2"
                  />
                )
              } else if (hash !== null) {
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
                      fill="none"
                      stroke={getColor(i)}
                      strokeWidth="2"
                    />
                  )
                }
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
              return null
            })}

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
            <div
              className="flex-shrink-0 truncate text-neutral-500 text-[10px]"
              style={{ width: colWidths.author }}
            >
              {commit.authorName}
            </div>
            <div
              className="flex-shrink-0 text-neutral-500 font-mono text-[10px]"
              style={{ width: colWidths.commit }}
            >
              {commit.hash.substring(0, 7)}
            </div>
            <div className="flex-1 min-w-0 text-right text-neutral-400 text-[10px] truncate">
              {new Date(commit.authorDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
