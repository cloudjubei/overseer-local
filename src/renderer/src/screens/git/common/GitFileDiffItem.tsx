import React from 'react'
import { GitMergeReportFile } from 'thefactory-tools'
import { IconChevron } from '@renderer/components/ui/icons/IconChevron'
import { StructuredUnifiedDiff, IntraMode } from '@renderer/components/chat/tool-popups/diffUtils'
import GitFileStatusIcon from './GitFileStatusIcon'

function extractBadges(file: GitMergeReportFile): string[] {
  const badges: string[] = []
  const st = String(file.status || '')
  const patch = String(file.patch || '')
  if (st === 'R' || /\nrename (from|to) /i.test(patch)) badges.push('renamed')
  if (/\n(old mode|new mode)\s+\d{6}/i.test(patch)) badges.push('mode')
  if (/\b120000\b/.test(patch) || /symlink/i.test(patch)) badges.push('symlink')
  return badges
}

export default function GitFileDiffItem({
  file,
  diffOpts,
}: {
  file: GitMergeReportFile
  diffOpts: { wrap: boolean; ignoreWS: boolean; intra: IntraMode }
}) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((v) => !v), [])
  const title = open ? 'Hide changes' : 'View changes'
  const showStats =
    file.status === 'M' &&
    (typeof file.additions === 'number' || typeof file.deletions === 'number')
  const badges = extractBadges(file)

  return (
    <div className="border rounded-md border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="px-3 py-2 text-xs flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/40">
        <div className="truncate font-mono pr-3 flex-1 flex items-center gap-2" title={file.path}>
          <GitFileStatusIcon status={file.status} />
          <span className="truncate">{file.path}</span>
          {badges.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1">
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="px-1 py-0.5 rounded bg-neutral-200/60 dark:bg-neutral-800/60 text-[10px] uppercase tracking-wide text-neutral-700 dark:text-neutral-300"
                >
                  {b}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-[10px] tracking-wide text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
            {showStats ? (
              <span className="ml-1">
                +{file.additions || 0}/-{file.deletions || 0}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggle}
            title={title}
            aria-label={title}
            aria-expanded={open}
            className={`ml-2 inline-flex items-center justify-center rounded p-1 transition-colors border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 ${open ? 'bg-neutral-200/60 dark:bg-neutral-800/60' : 'bg-transparent'}`}
          >
            <IconChevron
              className={`w-4 h-4 text-neutral-600 dark:text-neutral-300 transform transition-transform ${open ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>
      {open && (
        <div className="max-h-64 overflow-auto text-xs font-mono">
          {file.binary ? (
            <div className="p-3 text-neutral-600 dark:text-neutral-400">
              Binary file diff not shown
            </div>
          ) : file.patch ? (
            <div className="p-1">
              <StructuredUnifiedDiff
                patch={file.patch}
                wrap={diffOpts.wrap}
                ignoreWhitespace={diffOpts.ignoreWS}
                intraline={diffOpts.intra}
              />
            </div>
          ) : (
            <div className="p-3 text-neutral-600 dark:text-neutral-400">No patch available</div>
          )}
        </div>
      )}
    </div>
  )
}
