import React, { useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Code from '../../../ui/Code'
import Spinner from '../../../ui/Spinner'
import { StructuredUnifiedDiff } from '../../tool-popups/diffUtils'
import { PathDisplay } from '../../../ui/PathDisplay'
import GitFileStatusIcon from '../../../../screens/git/common/GitFileStatusIcon'
import { GitFileChangesPills } from '../../../../screens/git/common/GitFileChangesPills'

import { buildUnifiedDiffIfPresent, extract, isCompletelyNewFile, tryString } from '../utils'
import { IconChevronRight } from '@renderer/components/ui/icons/IconChevronRight'
import { cn } from '@renderer/utils/utils'

export function WriteToolsPreview({
  toolCall,
  result,
  resultType,
  sideBySide,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  sideBySide: boolean
  projectId?: string
}) {
  const toolName = String(toolCall?.name)
  const args = toolCall?.arguments || {}

  const isInFlight =
    resultType === 'pending' || resultType === 'running' || resultType === 'require_confirmation'

  // Check for explicit error in result, even if resultType isn't 'errored'
  const resultError = useMemo(() => {
    if (resultType === 'errored') {
      return (
        tryString(extract(result, ['message']) || extract(result, ['error']) || result) ||
        'Tool errored'
      )
    }
    const err = extract(result, ['error'])
    if (err) return tryString(err.message || err)
    return undefined
  }, [result, resultType])

  const isPreviewObject = result && typeof result === 'object' && 'status' in result

  if (isPreviewObject && result.status === 'error') {
    return errorContent(result.error || 'Preview failed')
  }

  // Unwrap the actual tool data from the ToolPreview if it is 'ready',
  // otherwise use the result directly (which means it's an executed tool result).
  const actualData = useMemo(() => {
    if (isPreviewObject) {
      if (result.status === 'ready') {
        // The ready patch might be a parsed array of file diff objects (from writeExactReplaces preview)
        // or a raw concatenated diff string.
        try {
          if (typeof result.patch === 'string' && toolName === 'writeExactReplaces') {
            const parsed = JSON.parse(result.patch)
            if (Array.isArray(parsed)) return parsed
          }
        } catch (e) {
          // ignore
        }
        return result.patch
      }
      return undefined // pending or error
    }
    return result
  }, [result, isPreviewObject, toolName])

  // When the tool succeeds, we expect a diff in the tool result.
  // writeExactReplaces may produce multiple diffs (one per file); handle that by building a
  // concatenated patch string for display.
  const successPatch = useMemo(() => {
    // Multi-write: actualData could be WriteExactReplaceResult[] directly.
    if (Array.isArray(actualData)) {
      const patches = actualData
        .map((r: any) => buildUnifiedDiffIfPresent(r) || tryString(extract(r, ['diff', 'patch'])))
        .filter((p: any): p is string => typeof p === 'string' && p.length > 0)

      if (patches.length > 0) return patches.join('\n')
    }
    // Preferred: unified diff is already present somewhere in the result (single-file tools).
    const single = buildUnifiedDiffIfPresent(actualData)
    if (single) return single

    // If actualData is just a string (e.g. from preview tool fallback), return it
    if (typeof actualData === 'string') return actualData

    return undefined
  }, [actualData])

  // Determine whether this is a brand new file (affects split toggle & banner)
  const isNewFile: boolean =
    toolName === 'writeFile' ? isCompletelyNewFile(actualData, successPatch) : false

  function spinnerContent(label?: string): React.ReactNode {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={20} label={label ?? 'Loading preview…'} />
      </div>
    )
  }

  function errorContent(message: string): React.ReactNode {
    return (
      <div className="text-xs text-red-500 py-2 px-1">
        <span className="font-semibold">Error:</span> {message}
      </div>
    )
  }

  function newFileBanner(): React.ReactNode {
    return <div className="mb-2 text-red-500 font-extrabold text-lg tracking-wide">NEW FILE</div>
  }

  // writeFile, writeDiffToFile, writeStructuredDiffToFile are display-equivalent: all are diffs.
  if (resultError) return errorContent(resultError)

  const multiResults = useMemo(() => {
    if (toolName !== 'writeExactReplaces') return undefined
    if (Array.isArray(actualData) && actualData.length > 0) return actualData
    return undefined
  }, [toolName, actualData])

  const uniquePathsCount = useMemo(() => {
    if (multiResults) {
      return new Set(multiResults.map((r) => r.path).filter(Boolean)).size
    }
    if (toolName === 'writeExactReplaces') {
      const queries = extract(args, ['queries'])
      if (Array.isArray(queries)) {
        return new Set(queries.map((q) => q.path).filter(Boolean)).size
      }
    }
    return 1
  }, [multiResults, toolName, args])

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  if (toolName === 'writeExactReplaces' && uniquePathsCount > 1) {
    if (isPreviewObject && result.status === 'pending')
      return spinnerContent('Loading diff preview…')
    if (isInFlight && !multiResults && !successPatch) return spinnerContent('Loading diff preview…')

    // If we have a successPatch from a ToolPreview but not multiResults, we must fallback to single viewer
    if (!multiResults && successPatch) {
      // Fall through to single patch viewer
    } else {
      const resultsToShow = multiResults || []
      if (resultsToShow.length === 0 && !isInFlight) {
        return <div className="text-[11px] text-[var(--text-secondary)]">No files changed</div>
      }

      if (resultsToShow.length === 0) {
        return spinnerContent('Loading diff preview…')
      }

      // Group by path
      const grouped = new Map<string, any[]>()
      for (const r of resultsToShow) {
        const path = tryString(r.path) || '(unknown)'
        if (!grouped.has(path)) grouped.set(path, [])
        grouped.get(path)!.push(r)
      }

      const groupsArray = Array.from(grouped.entries())

      return (
        <div className="flex flex-col min-h-0 border border-neutral-200 dark:border-neutral-800 rounded-md overflow-hidden bg-[var(--bg-primary)]">
          {groupsArray.map(([path, fileResults]) => {
            const isExpanded = expandedPaths.has(path)
            const combinedPatch = fileResults
              .map((r) => tryString(r.diff) || tryString(r.patch))
              .filter(Boolean)
              .join('\n')
            const anyErr = fileResults.find((r) => tryString(r.error))?.error
            const err = anyErr ? tryString(anyErr) : undefined

            return (
              <div
                key={path}
                className="group flex flex-col border-b last:border-b-0 border-neutral-200 dark:border-neutral-800"
              >
                <div
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] cursor-pointer select-none transition-colors"
                  onClick={() => togglePath(path)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <IconChevronRight
                      className={cn(
                        'w-3.5 h-3.5 text-neutral-400 transition-transform',
                        isExpanded && 'rotate-90',
                      )}
                    />
                    <GitFileStatusIcon status={'M'} />
                    <PathDisplay path={path} />
                  </div>
                  <div className="grid items-center shrink-0 min-h-[20px] justify-items-end pl-2">
                    {err ? (
                      <span className="text-red-500 text-[10px]">Error</span>
                    ) : (
                      <GitFileChangesPills patch={combinedPatch} />
                    )}
                  </div>
                </div>
                {err && !isExpanded ? (
                  <div className="text-[10px] text-red-500 px-2 pb-1.5 bg-[var(--bg-secondary)]">
                    {err}
                  </div>
                ) : null}

                {isExpanded && (
                  <div className="flex flex-col bg-[var(--bg-primary)] px-2 py-2 gap-2">
                    {fileResults.map((r, i) => {
                      const patch = tryString(r.diff) || tryString(r.patch)
                      const hunkErr = tryString(r.error)
                      if (!patch && !hunkErr) return null
                      return (
                        <div key={i} className="flex flex-col min-h-0">
                          {hunkErr ? (
                            <div className="text-xs text-red-500 mb-1">{hunkErr}</div>
                          ) : null}
                          {patch ? (
                            <StructuredUnifiedDiff patch={patch} sideBySide={sideBySide} />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
  }

  const patchToShow = successPatch

  if (isPreviewObject && result.status === 'pending') return spinnerContent('Loading diff preview…')

  if (!patchToShow) {
    if (isInFlight) return spinnerContent('Loading diff preview…')
    return <div className="text-[11px] text-[var(--text-secondary)]">No diff output</div>
  }

  // If patch looks like a unified diff, use the nice renderer.
  const isUnified = patchToShow.includes('@@')

  if (isNewFile) {
    return (
      <div>
        {newFileBanner()}
        <Code code={patchToShow} language="diff" />
      </div>
    )
  }

  if (isUnified) {
    return <StructuredUnifiedDiff patch={patchToShow} sideBySide={sideBySide} />
  }

  return <Code code={patchToShow} language="diff" />
}
