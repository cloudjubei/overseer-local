import { useFiles, inferFileType } from '../../contexts/FilesContext'
import FileDisplay from '../ui/FileDisplay'

export default function AttachmentList({
  attachments,
  onRemove,
  disabled,
}: {
  attachments: string[]
  onRemove: (path: string) => void
  disabled?: boolean
}) {
  const { filesByPath } = useFiles()
  if (!attachments.length) return null
  return (
    <div className="mb-1 flex flex-wrap gap-1">
      {attachments.map((path, idx) => {
        const meta = filesByPath[path]
        const name = meta?.name || path.split('/').pop() || path
        const type = meta?.type || inferFileType(path)
        const size = meta?.size ?? undefined
        const mtime = meta?.mtime ?? undefined
        const ctime = meta?.ctime ?? undefined
        return (
          <div key={`${idx}-${path}`} className="inline-flex items-center gap-1">
            <FileDisplay
              file={{ name, absolutePath: path, relativePath: path, type, size, mtime, ctime }}
              density="compact"
              interactive
              showPreviewOnHover
            />
            <button
              type="button"
              className="btn-secondary"
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(path)}
              disabled={disabled}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
