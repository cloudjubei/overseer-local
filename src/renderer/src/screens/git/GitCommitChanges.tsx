import React, { useEffect, useRef, useState } from 'react'
import Spinner from '../../components/ui/Spinner'
import { gitService } from '@renderer/services/gitService'
import { GitDiffSummary } from 'thefactory-tools'
import { ResizeHandle } from '../../components/ui/ResizeHandle'
import { PathDisplay } from '../../components/ui/PathDisplay'
import { DiffViewer } from '../../components/ui/DiffViewer'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import GitFileStatusIcon from './common/GitFileStatusIcon'
import { getFilePatch } from './common/gitUtils'

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
  const [leftWidth, setLeftWidth] = useLocalStorage<number>('GitCommitChanges_leftWidth', 300)
  const [vertHandleY, setVertHandleY] = useState<number | null>(null)
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
    <div
      className={`flex-1 min-h-0 flex flex-col bg-white dark:bg-neutral-900 ${className}`}
      ref={containerRef}
    >
      {loading ? (
        <div className="p-4 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <Spinner /> Loading commit changes…
        </div>
      ) : error ? (
        <div className="p-4 text-sm text-red-700 dark:text-red-200">
          Failed to load diff: {error}
        </div>
      ) : diff ? (
        <div className="flex min-h-0 h-full relative">
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
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <GitFileStatusIcon status={f.status} />
                      <PathDisplay path={f.path} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <ResizeHandle
            orientation="vertical"
            className="absolute top-0 bottom-0 z-10"
            style={{ left: leftWidth - 6 }}
            hitBoxSize={12}
            onResizeStart={onResizeStart}
            handlePos={vertHandleY ?? undefined}
            onMouseMove={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              setVertHandleY(e.clientY - r.top)
            }}
          />

          <div
            className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-neutral-900"
            style={{ width: `calc(100% - ${leftWidth}px)` }}
          >
            <DiffViewer
              path={activeFile?.path}
              patch={filePatch}
              wrap={wrap}
              ignoreWS={ignoreWS}
              intra={intra}
              onWrapChange={setWrap}
              onIgnoreWSChange={setIgnoreWS}
              onIntraChange={setIntra}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
