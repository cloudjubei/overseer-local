import { useMemo } from 'react'
import { useGitContext } from '../contexts/GitContext'

export default function useGit() {
  const { allProjects, currentProject, loading, error, refreshAll, refreshCurrent } = useGitContext()

  // Convenience derivations
  const pendingAll = useMemo(() => allProjects.flatMap((p) => p.pending || []), [allProjects])
  const pendingCurrent = useMemo(() => currentProject?.pending || [], [currentProject])

  return {
    loading,
    error,
    allProjects,
    currentProject,
    pendingAll,
    pendingCurrent,
    refreshAll,
    refreshCurrent,
  }
}
