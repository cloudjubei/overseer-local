import type { ReactNode } from 'react'
import { GitCommitGraph, type GitLogRefLike } from 'thefactory-ui/web'
import { useGit } from 'thefactory-ui/headless'

export type LogPanelProps = {
  selectedCommitSha?: string
  scrollToSha?: string
  onSelectCommit?: (sha: string) => void
  /**
   * Fired when the selected commit happens to be the tip of a branch — lets
   * the sidebar mirror the selection so picking a commit also picks the
   * matching branch (matches desktop's `onSelectBranchBySha` flow).
   */
  onSelectBranchBySha?: (sha: string) => void
  /** Right-click on a branch label in the graph: that branch's context menu. */
  onContextMenuRef?: (ref: GitLogRefLike, at: { x: number; y: number }) => void
  /** Each commit's sha as a chip in the graph. */
  renderCommitRef?: (sha: string) => ReactNode
}

// Renders the project's commit log as a visual branch-topology graph.
// `useGit().log` is pre-fetched by the GitContext; the graph component is
// purely presentational.
export default function LogPanel({
  selectedCommitSha,
  scrollToSha,
  onSelectCommit,
  onSelectBranchBySha,
  onContextMenuRef,
  renderCommitRef,
}: LogPanelProps = {}) {
  const { log, status, hasMoreLog, isLogLoading, loadMoreLog } = useGit()
  const uncommitted =
    (status?.staged.length ?? 0) +
      (status?.unstaged.length ?? 0) +
      (status?.untracked.length ?? 0) >
    0
  return (
    <GitCommitGraph
      commits={log}
      uncommittedChanges={uncommitted}
      selectedCommitSha={selectedCommitSha}
      scrollToSha={scrollToSha}
      onSelectCommit={onSelectCommit}
      onSelectBranchBySha={onSelectBranchBySha}
      onContextMenuRef={onContextMenuRef}
      renderCommitRef={renderCommitRef}
      onLoadMore={loadMoreLog}
      loadingMore={isLogLoading}
      hasMore={hasMoreLog}
    />
  )
}
