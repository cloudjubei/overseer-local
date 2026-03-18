import {
  IconFileAdded,
  IconFileDeleted,
  IconFileModified,
} from '../../../components/ui/icons/Icons'
import { IconWarningTriangle } from '../../../components/ui/icons/IconWarningTriangle'

export default function GitFileStatusIcon({
  status,
  isConflicted,
  className = 'w-4 h-4 flex-none',
}: {
  status?: string
  isConflicted?: boolean
  className?: string
}) {
  if (isConflicted) return <IconWarningTriangle className={`text-red-600 dark:text-red-400 ${className}`} />
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}
