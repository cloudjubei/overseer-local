import React, { useMemo, useState } from 'react'
import type { ToolCall, ToolResultType } from 'thefactory-tools'
import Spinner from '../../../ui/Spinner'
import { StructuredUnifiedDiff } from '../../tool-popups/diffUtils'
import { PathDisplay } from '../../../ui/PathDisplay'
import GitFileStatusIcon from '../../../../screens/git/common/GitFileStatusIcon'
import { GitFileChangesPills } from '../../../../screens/git/common/GitFileChangesPills'
import { tryString } from '../utils'
import { IconChevronRight } from '@renderer/components/ui/icons/IconChevronRight'
import { cn } from '@renderer/utils/utils'

export function WriteMultiToolsPreview({
  toolCall,
  result,
  resultType,
}: {
  toolCall: ToolCall
  result?: any
  resultType?: ToolResultType
  projectId?: string
}) {
  const isInFlight =
    resultType === 'pending' || resultType === 'running' || resultType === 'require_confirmation'

  // Check for explicit error in result, even if resultType isn't 'errored'
  const resultError: string | undefined = useMemo(() => {
    if (resultType === 'errored') {
      const msg = result?.message || result?.error || result?.result || String(result)
      return tryString(msg)
    }
    return undefined
  }, [result, resultType])

  const isPreviewObject = result && typeof result === 'object' && 'status' in result

  // Unwrap the actual tool data from the ToolPreview if it is 'ready',
  // otherwise use the result directly (which means it's an executed tool result).
  const actualData = useMemo(() => {
    if (isPreviewObject) {
      if (result.status === 'ready') {
        // The ready patch might be a parsed array of file diff objects (from writeExactReplaces preview)
        // or a raw concatenated diff string (but shouldn't happen for writeExactReplaces anymore).
        try {
          if (typeof result.patch === 'string') {
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
  }, [result, isPreviewObject])

  const multiResults = useMemo(() => {
    if (Array.isArray(actualData) && actualData.length > 0) return actualData
    return undefined
  }, [actualData])

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (multiResults) {
      const uniquePaths = Array.from(new Set(multiResults.map(r => tryString(r.path)).filter((p): p is string => Boolean(p))))
      if (uniquePaths.length === 1) {
        initial.add(uniquePaths[0])
      }
    }
    return initial
  })

  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  React.useEffect(() => {
    if (!hasAutoExpanded && multiResults && multiResults.length > 0) {
      const uniquePaths = Array.from(new Set(multiResults.map(r => tryString(r.path)).filter((p): p is string => Boolean(p))))
      if (uniquePaths.length === 1) {
        setExpandedPaths(new Set([uniquePaths[0]]))
      }
      setHasAutoExpanded(true)
    }
  }, [multiResults, hasAutoExpanded])

  const togglePath = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function spinnerContent(label?: string): React.ReactNode {
    return (
      <div className="flex items-center justify-center py-4">
        <Spinner size={20} label={label ?? 'Loading diff preview…'} />
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

  if (resultError) return errorContent(resultError)
  if (isPreviewObject && result.status === 'error') {
    return errorContent(result.error || 'Preview failed')
  }

  if (isPreviewObject && result.status === 'pending') return spinnerContent()
  if (isInFlight && !multiResults) return spinnerContent()

  const resultsToShow = multiResults || []
  if (resultsToShow.length === 0 && !isInFlight) {
    return <div className="text-[11px] text-[var(--text-secondary)]">No files changed</div>
  }

  if (resultsToShow.length === 0) {
    return spinnerContent()
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
                      {hunkErr ? <div className="text-xs text-red-500 mb-1">{hunkErr}</div> : null}
                      {patch ? (
                        <StructuredUnifiedDiff patch={patch} sideBySide={false} />
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
