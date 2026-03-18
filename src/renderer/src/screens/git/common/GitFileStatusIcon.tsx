import {
  IconFileAdded,
  IconFileDeleted,
  IconFileModified,
} from '../../../components/ui/icons/Icons'

export default function GitFileStatusIcon({
  status,
  className = 'w-4 h-4 flex-none',
}: {
  status?: string
  className?: string
}) {
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}
