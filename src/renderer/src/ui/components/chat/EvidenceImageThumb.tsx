import { useState } from 'react'
import { useReviewEvidenceImage } from 'thefactory-ui/headless'
import { EvidenceImageOverlay } from 'thefactory-ui/web'

/**
 * The screenshot a `recordReviewEvidence` call just filed, shown inside the
 * tool row: a correctly-proportioned thumbnail that opens the same full-screen
 * zoom viewer the review panel uses. Desktop peer of overseer-web's same-named
 * component.
 */
export default function EvidenceImageThumb({
  projectId,
  evidenceId,
  label,
}: {
  projectId: string | undefined
  evidenceId: string
  label?: string
}): React.JSX.Element | null {
  const { dataUri, loading } = useReviewEvidenceImage(projectId, evidenceId)
  const [open, setOpen] = useState(false)

  if (loading && !dataUri) {
    return (
      <div className="h-24 w-16 rounded border border-(--border-subtle) bg-(--surface-hover)" />
    )
  }
  if (!dataUri) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View full size"
        aria-label={`View ${label ?? 'screenshot'} full size`}
        className="rounded border border-(--border-subtle) hover:opacity-90"
      >
        <img
          src={dataUri}
          alt={label ?? 'screenshot'}
          className="block h-32 w-auto max-w-full rounded object-contain"
        />
      </button>
      <EvidenceImageOverlay
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label ?? 'Screenshot'}
        images={[{ id: evidenceId, caption: label ?? 'Screenshot', dataUri }]}
      />
    </>
  )
}
