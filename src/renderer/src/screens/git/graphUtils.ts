import { GitLogCommit } from 'thefactory-tools'

export type GraphNode = {
  commit: GitLogCommit
  nodeLane: number
  incomingLanes: (string | null)[]
  outgoingLanes: (string | null)[]
  maxLanes: number
}

export function computeCommitGraph(commits: GitLogCommit[]): GraphNode[] {
  const nodes: GraphNode[] = []
  let currentLanes: (string | null)[] = []

  for (const commit of commits) {
    const incomingLanes = [...currentLanes]
    const outgoingLanes = [...currentLanes]

    let nodeLane = incomingLanes.indexOf(commit.hash)
    if (nodeLane === -1) {
      nodeLane = incomingLanes.indexOf(null)
      if (nodeLane === -1) {
        nodeLane = incomingLanes.length
        outgoingLanes.push(null)
      }
    }

    // Merge multiple incoming lanes that point to this commit (e.g. branch merges)
    for (let i = 0; i < incomingLanes.length; i++) {
      if (incomingLanes[i] === commit.hash && i !== nodeLane) {
        outgoingLanes[i] = null // Free up this lane
      }
    }

    // Replace the node's lane with its first parent
    if (commit.parents.length > 0) {
      outgoingLanes[nodeLane] = commit.parents[0]
      
      // Add additional parents
      for (let i = 1; i < commit.parents.length; i++) {
        const p = commit.parents[i]
        // Check if this parent is already expected in some lane
        if (!outgoingLanes.includes(p)) {
          let emptyIdx = outgoingLanes.indexOf(null)
          if (emptyIdx === -1) {
            emptyIdx = outgoingLanes.length
            outgoingLanes.push(null)
          }
          outgoingLanes[emptyIdx] = p
        }
      }
    } else {
      outgoingLanes[nodeLane] = null
    }

    // Remove trailing nulls to keep maxLanes minimal
    while (outgoingLanes.length > 0 && outgoingLanes[outgoingLanes.length - 1] === null) {
      outgoingLanes.pop()
    }

    nodes.push({
      commit,
      nodeLane,
      incomingLanes,
      outgoingLanes,
      maxLanes: Math.max(incomingLanes.length, outgoingLanes.length)
    })

    currentLanes = [...outgoingLanes]
  }

  return nodes
}
