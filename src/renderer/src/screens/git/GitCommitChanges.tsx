import React, { useEffect, useRef, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { gitService } from '@renderer/services/gitService'
import { GitDiffSummary } from 'thefactory-tools'
import { StructuredUnifiedDiff } from '@renderer/components/chat/tool-popups/diffUtils'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { IconFileAdded, IconFileDeleted, IconFileModified } from '../../components/ui/icons/Icons'

function StatusIcon({ status, className = 'w-4 h-4 flex-none' }: { status?: string; className?: string }) {
  if (status === 'A') return <IconFileAdded className={className} />
  if (status === 'D') return <IconFileDeleted className={className} />
  return <IconFileModified className={className} />
}

export function getFilePatch(diffPatch: string | undefined, path: string): string | undefined {
  if (!diffPatch) return undefined
  const blocks = diffPatch.split('\ndiff --git ')
  for (let i = 0; i < blocks.length; i++) {
    let block = blocks[i]
    if (i === 0) {
      if (!block.startsWith('diff --git ')) continue
      block = block.slice('diff --git '.length)
    }
    if (
      block.includes(` b/${path}\n`) ||
      block.includes(` b/${path}\r\n`) ||
      block.startsWith(`a/${path} b/${path}\n`)
    ) {
      return `diff --git ${block}`
    }
  }
  return undefined
}

export function GitCommitChanges({
  projectId,
  commitSha,
  className = '',
}: {
  projectId: string
  commitSha: string
  className?: string
}) {
  const [diff, setDiff] = useState<GitDiffSummary | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(300)
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null)

  const [wrap, setWrap] = useState(false)
  const [ignoreWS, setIgnoreWS] = useState(false)
  const [intra, setIntra] = useState<'none' | 'word' | 'char'>('word')

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resizeRef.current = { startX: e.clientX, startW: leftWidth }

    const onMove = (ev: PointerEvent) => {
      const st = resizeRef.current
      if (!st) return
      const dx = ev.clientX - st.startX
      const newW = st.startW + dx
      setLeftWidth(Math.max(150, Math.min(newW, 600)))
    }
    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    if (!projectId || !commitSha) return

    let isMounted = true
    setLoading(true)
    setError(undefined)
    setSelectedFile(null)

    gitService
      .getBranchDiffSummary(projectId, {
        baseRef: `${commitSha}^`,
        headRef: commitSha,
        includePatch: true,
      })
      .then((res) => {
        if (!isMounted) return
        setDiff(res)
        if (res.files.length > 0) {
          setSelectedFile(res.files[0].path)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err?.message || 'Failed to load commit diff')
      })
      .finally(() => {
        if (!isMounted) return
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [projectId, commitSha])

  const activeFile = diff?.files.find((f) => f.path === selectedFile)
  const filePatch = activeFile?.patch || getFilePatch(diff?.patch, activeFile?.path || '')

  return (
    <div className={`flex-1 min-h-0 flex flex-col bg-white dark:bg-neutral-900 ${className}`} ref={containerRef}>
      {loading ? (
        <div className="p-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <Spinner /> Loading commit changes…
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-red-700 dark:text-red-200">Failed to load diff: {error}</div>
      ) : diff ? (
        <div className="flex min-h-0 h-full">
          <div
            className="flex flex-col min-h-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/50"
            style={{ width: leftWidth }}
          >
            <div className="bg-neutral-100 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 uppercase tracking-wide flex justify-between items-center">
              <span>Files ({diff.files.length})</span>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800 overflow-auto flex-1 p-1">
              {diff.files.map((f, i) => {
                const isSelected = f.path === selectedFile
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md ${
                      isSelected
                        ? 'bg-sky-50 dark:bg-sky-900/25 text-sky-900 dark:text-sky-100'
                        : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/50'
                    }`}
                    onClick={() => setSelectedFile(f.path)}
                  >
                    <StatusIcon status={f.status} />
                    <span className="truncate flex-1">{f.path}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <ResizeHandle orientation="vertical" onResizeStart={onResizeStart} />

          <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-neutral-900">
            <div className="bg-neutral-100 dark:bg-neutral-800/50 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200 flex justify-between items-center shrink-0">
              <span className="truncate flex-1 mr-4">{activeFile?.path || 'No file selected'}</span>
              {activeFile && (
                <div className="flex items-center gap-3 shrink-0 font-normal">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
                    <span>Wrap</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={ignoreWS} onChange={(e) => setIgnoreWS(e.target.checked)} />
                    <span>Ignore WS</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <span>Intra</span>
                    <select
                      className="border border-neutral-200 dark:border-neutral-800 bg-transparent rounded px-1 py-0.5"
                      value={intra}
                      onChange={(e) => setIntra(e.target.value as any)}
                    >
                      <option value="none">none</option>
                      <option value="word">word</option>
                      <option value="char">char</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
            {activeFile ? (
              filePatch ? (
                <div className="flex-1 min-h-0 overflow-auto">
                  <StructuredUnifiedDiff patch={filePatch} wrap={wrap} ignoreWhitespace={ignoreWS} intraline={intra} />
                </div>
              ) : (
                <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
                  No diff available (possibly binary or identical).
                </div>
              )
            ) : (
              <div className="p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center justify-center h-full">
                Select a file to view its diff.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
