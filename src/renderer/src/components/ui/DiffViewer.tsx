import React from 'react'
import { StructuredUnifiedDiff, IntraMode } from '../chat/tool-popups/diffUtils'
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
}: DiffViewerProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-neutral-900 w-full h-full">
      <div className="px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-2 w-full shrink-0 min-h-0 bg-neutral-100 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between min-w-0">
          {path ? (
            <>
              <div className="flex-1 min-w-0 mr-4 font-semibold text-neutral-700 dark:text-neutral-200">
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
        {path ? (
          <div className="flex items-center gap-3 shrink-0 font-normal">
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
        ) : null}
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-auto p-2 w-full min-h-0">
        {path ? (
          patch ? (
            <StructuredUnifiedDiff
              patch={patch}
              wrap={wrap}
              ignoreWhitespace={ignoreWS}
              intraline={intra}
            />
          ) : (
            <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
              No patch available for {path} (possibly binary or identical).
            </div>
          )
        ) : (
          <div className="text-xs text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
            Select a file to view its diff.
          </div>
        )}
      </div>
    </div>
  )
}
