import React, { useState, useEffect } from 'react'
import {
  StructuredUnifiedDiff,
  IntraMode,
  parseUnifiedDiff,
  generateSelectedPatch,
  generateHunkPatch,
} from '../chat/tool-popups/diffUtils'
import { PathDisplay } from './PathDisplay'
import { FileChangesPills } from '../../screens/git/GitLocalChanges'

export interface DiffViewerProps {
  path?: string
  patch?: string
  wrap: boolean
  ignoreWS: boolean
  intra: IntraMode
  onWrapChange: (val: boolean) => void
  onIgnoreWSChange: (val: boolean) => void
  onIntraChange: (val: IntraMode) => void
  /** Called when the user wants to apply a partial/full patch. reverse=true means unstage/discard. */
  onApplyPatch?: (patch: string, reverse: boolean) => void
  /** Called when the user wants to discard (reset) a patch chunk — no staging, just discard. */
  onDiscardPatch?: (patch: string) => void
  isStaged?: boolean
}

export function DiffViewer({
  path,
  patch,
  wrap,
  ignoreWS,
  intra,
  onWrapChange,
  onIgnoreWSChange,
  onIntraChange,
  onApplyPatch,
  onDiscardPatch,
  isStaged,
}: DiffViewerProps) {
  // Edit mode is only available when an apply handler is provided
  const isEditable = !!onApplyPatch

  const [selectable, setSelectable] = useState(false)
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())

  // Reset selection when patch or file changes
  useEffect(() => {
    setSelectedLines(new Set())
    setSelectable(false)
  }, [patch, path])

  const toggleLineSelection = (hunkIndex: number, lineIndex: number) => {
    const newSelection = new Set(selectedLines)
    const key = `${hunkIndex}:${lineIndex}`
    if (newSelection.has(key)) {
      newSelection.delete(key)
    } else {
      newSelection.add(key)
    }
    setSelectedLines(newSelection)
  }

  const toggleHunkSelection = (hunkIndex: number) => {
    if (!patch) return
    const hunks = parseUnifiedDiff(patch)
    const hunk = hunks[hunkIndex]
    if (!hunk) return

    const newSelection = new Set(selectedLines)
    const modLines = hunk.lines
      .map((l, idx) => ({ l, idx }))
      .filter(({ l }) => l.type === 'add' || l.type === 'del')

    const isAllSelected = modLines.every(({ idx }) => newSelection.has(`${hunkIndex}:${idx}`))

    modLines.forEach(({ idx }) => {
      const key = `${hunkIndex}:${idx}`
      if (isAllSelected) {
        newSelection.delete(key)
      } else {
        newSelection.add(key)
      }
    })

    setSelectedLines(newSelection)
  }

  const handleApplySelection = () => {
    if (!patch || !onApplyPatch) return
    const partialPatch = generateSelectedPatch(patch, selectedLines)
    onApplyPatch(partialPatch, !!isStaged)
    setSelectable(false)
    setSelectedLines(new Set())
  }

  const handleDiscardSelection = () => {
    if (!patch || !onDiscardPatch) return
    const partialPatch = generateSelectedPatch(patch, selectedLines)
    onDiscardPatch(partialPatch)
    setSelectable(false)
    setSelectedLines(new Set())
  }

  const handleStageHunk = (hunkIndex: number) => {
    if (!patch || !onApplyPatch) return
    const hunkPatch = generateHunkPatch(patch, hunkIndex)
    onApplyPatch(hunkPatch, false)
  }

  const handleUnstageHunk = (hunkIndex: number) => {
    if (!patch || !onApplyPatch) return
    const hunkPatch = generateHunkPatch(patch, hunkIndex)
    onApplyPatch(hunkPatch, true)
  }

  const handleDiscardHunk = (hunkIndex: number) => {
    if (!patch || !onDiscardPatch) return
    const hunkPatch = generateHunkPatch(patch, hunkIndex)
    onDiscardPatch(hunkPatch)
  }

  const hasSelection = selectedLines.size > 0

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-neutral-900 w-full h-full">
      {/* Toolbar */}
      <div className="text-xs text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex flex-col w-full shrink-0 bg-neutral-100 dark:bg-neutral-800/50">

        {/* Row 1 — file name + pills */}
        <div className="px-2 py-2 flex items-center justify-between min-w-0">
          {path ? (
            <>
              <div className="flex-1 min-w-0 mr-4 font-semibold text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
                <PathDisplay path={path} />
              </div>
              <div className="shrink-0 flex items-center">
                <FileChangesPills patch={patch} />
              </div>
            </>
          ) : (
            <span className="opacity-70">No file selected</span>
          )}
        </div>

        {/* Row 2 — view options */}
        {path && (
          <div className="px-2 pb-2 flex items-center gap-3 shrink-0 font-normal border-t border-neutral-200 dark:border-neutral-700 pt-1.5">
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={wrap}
                onChange={(e) => onWrapChange(e.target.checked)}
              />
              <span>Wrap</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={ignoreWS}
                onChange={(e) => onIgnoreWSChange(e.target.checked)}
              />
              <span>Ignore WS</span>
            </label>
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <span>Intra</span>
              <select
                className="border border-neutral-200 dark:border-neutral-800 bg-transparent rounded px-1 py-0.5"
                value={intra}
                onChange={(e) => onIntraChange(e.target.value as IntraMode)}
              >
                <option value="none">none</option>
                <option value="word">word</option>
                <option value="char">char</option>
              </select>
            </label>
          </div>
        )}

        {/* Row 3 — selection actions + exit (only in edit mode) */}
        {path && isEditable && (
          <div className="px-2 border-t border-neutral-200 dark:border-neutral-700 flex items-center h-[50px]">
            {/* Left: Stage/Discard selected — always rendered in selection mode, disabled if no selection */}
            <div className="flex items-center gap-2 flex-1">
              {selectable && (
                <>
                  <button
                    onClick={handleApplySelection}
                    disabled={!hasSelection}
                    className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                      hasSelection
                        ? 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                    }`}
                  >
                    {isStaged ? 'Unstage Selected' : 'Stage Selected'}
                  </button>
                  {!isStaged && (
                    <button
                      onClick={handleDiscardSelection}
                      disabled={!hasSelection}
                      className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                        hasSelection
                          ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
                          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                      }`}
                    >
                      Discard Selected
                    </button>
                  )}
                </>
              )}
            </div>
            {/* Right: Select Lines / Exit Selection toggle */}
            <button
              className={`px-3 py-1 rounded text-[11px] font-medium border transition-colors ${
                selectable
                  ? 'bg-white border-black text-black hover:bg-neutral-100 ml-4'
                  : 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200'
              }`}
              onClick={() => {
                setSelectable((s) => {
                  if (s) setSelectedLines(new Set())
                  return !s
                })
              }}
            >
              {selectable ? 'Exit Selection' : 'Select Lines'}
            </button>
          </div>
        )}
      </div>

      {/* Diff area — single scrollable container (vertical only), diff fills edge-to-edge */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
        {path ? (
          patch ? (
            <StructuredUnifiedDiff
              patch={patch}
              wrap={wrap}
              ignoreWhitespace={ignoreWS}
              intraline={intra}
              selectable={selectable}
              selectedLines={selectedLines}
              onToggleLineSelection={toggleLineSelection}
              onToggleHunkSelection={toggleHunkSelection}
              isStaged={isStaged}
              isEditable={isEditable}
              onStageHunk={handleStageHunk}
              onUnstageHunk={handleUnstageHunk}
              onDiscardHunk={handleDiscardHunk}
            />
          ) : (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full p-4">
              No patch available for {path} (possibly binary or identical).
            </div>
          )
        ) : (
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full p-4">
            Select a file to view its diff.
          </div>
        )}
      </div>
    </div>
  )
}
