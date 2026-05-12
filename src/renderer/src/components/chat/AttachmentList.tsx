import { inferFileType } from 'thefactory-tools/utils'
import { useFiles } from '../../contexts/FilesContext'
import { FileDisplay } from 'thefactory-ui/web'

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
        return (
          <div key={`${idx}-${path}`} className="inline-flex items-center gap-1">
            <FileDisplay
              file={{ name, absolutePath: path, relativePath: path, type, size, mtime }}
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
