import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProcessGroupRun } from 'thefactory-ui/headless/api'

/**
 * Open a group run on its group's Processes tab. A caller that knows only the
 * group run's id (a project's leg pipeline) has the group looked up first.
 */
export function useNavigateToGroupRun(): (groupRunId: string, groupId?: string) => void {
  const navigate = useNavigate()
  return useCallback(
    (groupRunId: string, groupId?: string) => {
      const open = (id: string) => navigate(`/groups/${id}/processes/${groupRunId}`)
      if (groupId) {
        open(groupId)
        return
      }
      void getProcessGroupRun({ path: { groupRunId } })
        .then(({ data }) => {
          if (data?.groupId) open(data.groupId)
        })
        .catch(() => undefined)
    },
    [navigate],
  )
}
