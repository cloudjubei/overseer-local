import { useAgents } from '../../contexts/AgentsContext'
import DotBadge from '../ui/DotBadge'

  const { isRunUnread, markRunSeen } = useAgents()
  const unread = isRunUnread(run)
  return (
    <tr
      id={`run-${run.id ?? 'unknown'}`}
      className="border-t border-neutral-200 dark:border-neutral-800 group"
      onMouseEnter={() => {
        if (unread && run.id) markRunSeen(run.id)
      }}
      onFocus={() => {
        if (unread && run.id) markRunSeen(run.id)
      }}
    >
      <td className="px-3 py-2 leading-tight w-4">
        {unread ? (
          <DotBadge title={'Run completed (unseen)'} />
        ) : (
          <span className="inline-block w-2.5" aria-hidden />
        )}
      </td>