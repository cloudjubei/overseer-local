import { AgentRunState } from 'thefactory-tools'
import {
  IconCheckCircle,
  IconLightbulb,
  IconLoader,
  IconStopCircle,
  IconXCircle,
} from '../ui/Icons'
import Tooltip from '../ui/Tooltip'

export function StatusIcon({ state, className }: { state: AgentRunState; className?: string }) {
  switch (state) {
    case 'created':
      return <IconLightbulb className={className} />
    case 'running':
      return <IconLoader className={`${className ?? ''} icon--spin`} />
    case 'completed':
      return <IconCheckCircle className={className} />
    case 'cancelled':
      return <IconStopCircle className={className} />
    case 'error':
      return <IconXCircle className={className} />
    default:
      return <span className={className}>?</span>
  }
}

function bgClasses(state: AgentRunState) {
  switch (state) {
    case 'running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100 border-blue-200 dark:border-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-100 border-green-200 dark:border-green-800'
    case 'cancelled':
      return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700'
    case 'error':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-100 border-red-200 dark:border-red-800'
    default:
      return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700'
  }
}

export default function StatusChip({ state, label }: { state: AgentRunState; label?: string }) {
  const text = label ?? state
  return (
    <Tooltip content={<span className="text-xs">{text}</span>}>
      <span
        className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium ${bgClasses(state)}`}
        aria-label={typeof text === 'string' ? text : undefined}
        aria-busy={state === 'running' ? true : undefined}
      >
        <StatusIcon state={state} className="w-3.5 h-3.5" />
      </span>
    </Tooltip>
  )
}
