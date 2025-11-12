import React from 'react'
import { filesService } from '@renderer/services/filesService'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { GitConflictEntry } from 'thefactory-tools'
import { gitService } from '@renderer/services/gitService'

export type MergeConflictResolverProps = {
  projectId: string
  baseRef: string
  branch: string
  conflicts: GitConflictEntry[]
}

type SegmentText = { type: 'text'; text: string }

type SegmentConflict = {
  type: 'conflict'
  oursLabel: string
  theirsLabel: string
  ours: string
  theirs: string
}

type Segment = SegmentText | SegmentConflict

function hasConflictMarkers(s: string): boolean {
  return /<<<<<<< |>>>>>>> |=======/.test(s)
}

function parseConflictSegments(raw: string): Segment[] {
  const text = (raw || '').replace(/\r\n/g, '\n')
  const segments: Segment[] = []
  let i = 0
  while (i < text.length) {
    const startIdx = text.indexOf('<<<<<<< ', i)
    if (startIdx === -1) {
      segments.push({ type: 'text', text: text.slice(i) })
      break
    }
    if (startIdx > i) segments.push({ type: 'text', text: text.slice(i, startIdx) })

    const lineEnd = text.indexOf('\n', startIdx)
    const oursHeader = text.slice(startIdx + '<<<<<<< '.length, lineEnd === -1 ? text.length : lineEnd)

    const sepNeedle = '\n=======\n'
    const sepIdx = text.indexOf(sepNeedle, lineEnd === -1 ? startIdx : lineEnd + 1)
    if (sepIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }

    const oursContent = text.slice((lineEnd === -1 ? startIdx : lineEnd + 1), sepIdx)
    const endMarker = '\n>>>>>>>'
    const endIdx = text.indexOf(endMarker, sepIdx + sepNeedle.length)
    if (endIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }
    const theirsHeaderLineEnd = text.indexOf('\n', endIdx + endMarker.length)
    const theirsHeader = text.slice(
      endIdx + endMarker.length + 1,
      theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd,
    )
    const theirsContent = text.slice(sepIdx + sepNeedle.length, endIdx)

    segments.push({
      type: 'conflict',
      oursLabel: oursHeader || 'ours',
      theirsLabel: theirsHeader || 'theirs',
      ours: oursContent,
      theirs: theirsContent,
    })
    i = (theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd + 1)
  }
  return segments
}

function renderCodeBlock(s: string) {
  const lines = (s || '').replace(/\r\n/g, '\n').split('\n')
  return (
    <pre className='text-xs font-mono whitespace-pre-wrap max-h-64 overflow-auto border border-neutral-200 dark:border-neutral-800 rounded-md'>
      <code>
        {lines.map((l, idx) => (
          <span key={idx} className='block px-2 py-0.5'>
            {l || ' '}
          </span>
        ))}
      </code>
    </pre>
  )
}

function joinSegments(segments: Segment[]): string {
  return segments
    .map((seg) => (seg.type === 'text' ? seg.text : `<<<<<<< ${seg.oursLabel}\n${seg.ours}\n=======\n${seg.theirs}\n>>>>>>> ${seg.theirsLabel}\n`))
    .join('')
}

export default function MergeConflictResolver({ projectId, baseRef, branch, conflicts }: MergeConflictResolverProps) {
  const [selected, setSelected] = React.useState<string | null>(conflicts[0]?.path || null)

  // Editor states
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>('')
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [dirty, setDirty] = React.useState(false)

  // Triples for 3-pane context
  const [oursText, setOursText] = React.useState<string>('')
  const [theirsText, setTheirsText] = React.useState<string>('')
  const [triplesLoading, setTriplesLoading] = React.useState<boolean>(false)

  // Sidebar/search and session controls
  const [search, setSearch] = React.useState<string>('')
  const [abortRunning, setAbortRunning] = React.useState<boolean>(false)
  const [finalizing, setFinalizing] = React.useState<boolean>(false)
  const [finalizeMsg, setFinalizeMsg] = React.useState<string>(() => `Merge branch ${branch}`)
  const [pushImmediately, setPushImmediately] = React.useState<boolean>(false)

  // Track original conflicted content for reset
  const originalByPathRef = React.useRef<Record<string, string>>({})

  // Track resolved map to compute x/y resolved
  const [resolvedMap, setResolvedMap] = React.useState<Record<string, boolean>>({})
  const totalFiles = conflicts.length
  const resolvedCount = React.useMemo(() => Object.values(resolvedMap).filter(Boolean).length, [resolvedMap])
  const allResolved = totalFiles > 0 && resolvedCount === totalFiles

  const currentConflict = conflicts.find((c) => c.path === selected) || null
  const isBinary = currentConflict?.type && /binary/i.test(String(currentConflict.type))
  const unresolvedCount = React.useMemo(() => segments.filter((s) => s.type === 'conflict').length, [segments])

  const loadTriples = React.useCallback(async (path: string | null, base: string, incoming: string) => {
    if (!path) return
    try {
      setTriplesLoading(true)
      const [ours, theirs] = await Promise.all([
        gitService.getFileContent(projectId, path, base),
        gitService.getFileContent(projectId, path, incoming),
      ])
      setOursText(ours || '')
      setTheirsText(theirs || '')
    } catch {
      setOursText('')
      setTheirsText('')
    } finally {
      setTriplesLoading(false)
    }
  }, [projectId])

  const loadFile = React.useCallback(async (path: string | null) => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const raw = await filesService.readFile(projectId, path, 'utf8')
      const data = raw ?? ''
      setContent(data)
      setSegments(parseConflictSegments(data))
      if (!originalByPathRef.current[path]) originalByPathRef.current[path] = data
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [path]: !hasConflictMarkers(data) }))
    } catch (e: any) {
      setError(e?.message || 'Failed to read file')
      setContent('')
      setSegments([])
      setResolvedMap((prev) => ({ ...prev, [path!]: false }))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const recomputeResolvedAll = React.useCallback(async () => {
    const map: Record<string, boolean> = {}
    for (const c of conflicts) {
      try {
        const txt = await filesService.readFile(projectId, c.path, 'utf8')
        map[c.path] = !hasConflictMarkers(String(txt || ''))
      } catch {
        map[c.path] = false
      }
    }
    setResolvedMap(map)
  }, [conflicts, projectId])

  React.useEffect(() => {
    void loadFile(selected)
  }, [selected, loadFile])

  React.useEffect(() => {
    if (!selected) return
    void loadTriples(selected, baseRef, branch)
  }, [selected, baseRef, branch, loadTriples])

  React.useEffect(() => {
    // On mount or conflicts change, compute resolved states
    void recomputeResolvedAll()
  }, [recomputeResolvedAll])

  const applyChoice = (index: number, choice: 'ours' | 'theirs' | 'both') => {
    setSegments((prev) => {
      const next = [...prev]
      const seg = next[index]
      if (!seg || seg.type !== 'conflict') return prev
      let replacement = ''
      if (choice === 'ours') replacement = seg.ours
      else if (choice === 'theirs') replacement = seg.theirs
      else replacement = seg.ours + (seg.ours && seg.theirs ? '\n' : '') + seg.theirs
      next.splice(index, 1, { type: 'text', text: replacement })
      const joined = joinSegments(next)
      setDirty(true)
      setContent(joined)
      return next
    })
  }

  const applyChoiceAll = (choice: 'ours' | 'theirs' | 'both') => {
    setSegments((prev) => {
      const next: Segment[] = prev.map((seg) => {
        if (seg.type !== 'conflict') return seg
        if (choice === 'ours') return { type: 'text', text: seg.ours }
        if (choice === 'theirs') return { type: 'text', text: seg.theirs }
        return { type: 'text', text: seg.ours + (seg.ours && seg.theirs ? '\n' : '') + seg.theirs }
      })
      const joined = joinSegments(next)
      setDirty(true)
      setContent(joined)
      return next
    })
  }

  const onManualEditChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    setSegments(parseConflictSegments(val))
    setDirty(true)
  }

  const onSave = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      await filesService.writeFile(projectId, selected, content)
      try {
        // Stage immediately after save so git can consider it resolved
        await gitService.stage(projectId, [selected])
      } catch {}
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [selected]: !hasConflictMarkers(content) }))
    } catch (e: any) {
      setError(e?.message || 'Failed to save file')
    } finally {
      setSaving(false)
      try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
    }
  }

  const onRefresh = async () => {
    await loadFile(selected)
    if (selected) await loadTriples(selected, baseRef, branch)
  }

  const acceptFile = async (side: 'ours' | 'theirs') => {
    if (!selected) return
    const txt = side === 'ours' ? oursText : theirsText
    setContent(txt)
    setSegments(parseConflictSegments(txt))
    setDirty(true)
  }

  const resetFileToOriginal = async () => {
    if (!selected) return
    const orig = originalByPathRef.current[selected]
    if (typeof orig !== 'string') return
    try {
      await filesService.writeFile(projectId, selected, orig)
      setContent(orig)
      setSegments(parseConflictSegments(orig))
      setDirty(false)
      setResolvedMap((prev) => ({ ...prev, [selected]: !hasConflictMarkers(orig) }))
    } catch (e: any) {
      setError(e?.message || 'Failed to reset file')
    }
  }

  return (
    <div className='flex flex-col gap-3 min-h-[480px]'>
      <div className='flex gap-3 min-h-[420px]'>
        {/* Sidebar */}
        <div className='w-64 shrink-0 border rounded-md border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden'>
          <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-neutral-50 dark:bg-neutral-900/40'>
            Conflicted files
          </div>
          <div className='p-2'>
            <input
              type='text'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Filter files...'
              className='w-full px-2 py-1.5 text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-transparent'
            />
          </div>
          <div className='flex-1 overflow-auto text-sm divide-y divide-neutral-100 dark:divide-neutral-900'>
            {conflicts
              .filter((c) => !search || c.path.toLowerCase().includes(search.toLowerCase()))
              .map((c) => {
                const isSel = c.path === selected
                const statusCls = isSel ? 'bg-neutral-100 dark:bg-neutral-900/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
                const isResolved = resolvedMap[c.path]
                return (
                  <div
                    key={c.path}
                    className={`px-3 py-2 cursor-pointer ${statusCls} group`}
                    onClick={() => setSelected(c.path)}
                    title={c.path}
                  >
                    <div className='truncate font-mono'>{c.path}</div>
                    <div className='text-[11px] text-neutral-500'>
                      {isResolved ? 'Resolved' : 'Unresolved'}
                    </div>
                    <div className='mt-1 hidden group-hover:flex items-center gap-1'>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void acceptFile('ours') }}>Accept ours</Button>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void acceptFile('theirs') }}>Accept theirs</Button>
                      <Button size='xs' variant='ghost' onClick={(e) => { e.stopPropagation(); void resetFileToOriginal() }}>Reset file</Button>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Main area */}
        <div className='flex-1 min-w-0 border rounded-md border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden'>
          <div className='px-3 py-2 flex items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-900'>
            <div className='text-sm'>
              {selected ? <span className='font-mono'>{selected}</span> : 'Select a file'}
              {selected && (
                <span className='ml-2 text-xs text-neutral-600 dark:text-neutral-400'>
                  {hasConflictMarkers(content) ? `${unresolvedCount} conflict${unresolvedCount === 1 ? '' : 's'} remaining` : 'No conflicts detected'}
                </span>
              )}
            </div>
            <div className='flex items-center gap-2'>
              <Tooltip content={'reload from disk'} placement='bottom'>
                <span>
                  <Button variant='ghost' size='sm' onClick={onRefresh} disabled={loading || saving}>
                    Refresh
                  </Button>
                </span>
              </Tooltip>
              <Tooltip content={'save & stage'} placement='bottom'>
                <span>
                  <Button onClick={onSave} loading={saving} disabled={!dirty || saving || !selected}>
                    Save & Stage
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>

          {!selected ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>Select a conflicted file to resolve.</div>
          ) : loading ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2'>
              <Spinner size={14} label='Loading file...' />
            </div>
          ) : isBinary ? (
            <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>
              Binary conflict. Use file-level actions (Accept ours/theirs) and Save & Stage.
              <div className='mt-2 flex items-center gap-2'>
                <Button size='sm' onClick={() => void acceptFile('ours')}>Accept ours</Button>
                <Button size='sm' onClick={() => void acceptFile('theirs')}>Accept theirs</Button>
                <Button size='sm' variant='secondary' onClick={() => void onSave()}>Save & Stage</Button>
              </div>
            </div>
          ) : (
            <div className='flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3'>
              {error && (
                <div className='text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
              )}

              {/* 3-pane context */}
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-3'>
                <div className='min-w-0'>
                  <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Theirs (incoming)</div>
                  {triplesLoading ? (
                    <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
                  ) : renderCodeBlock(theirsText)}
                </div>
                <div className='min-w-0'>
                  <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Result (editable)</div>
                  <textarea
                    value={content}
                    onChange={onManualEditChange}
                    className='w-full h-56 lg:h-full min-h-[224px] font-mono text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent p-2 resize-vertical'
                    spellCheck={false}
                  />
                </div>
                <div className='min-w-0'>
                  <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Ours (current)</div>
                  {triplesLoading ? (
                    <div className='text-xs text-neutral-600 dark:text-neutral-400 flex items-center gap-2'><Spinner size={12} label='Loading...' /></div>
                  ) : renderCodeBlock(oursText)}
                </div>
              </div>

              {/* Per-hunk controls and segments */}
              {segments.some((s) => s.type === 'conflict') && (
                <div className='flex items-center gap-2'>
                  <Tooltip content={'accept all ours/current'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('ours')}>
                        Accept ours (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip content={'accept all theirs/incoming'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('theirs')}>
                        Accept theirs (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <Tooltip content={'concatenate both sides for all hunks'} placement='bottom'>
                    <span>
                      <Button variant='secondary' size='sm' onClick={() => applyChoiceAll('both')}>
                        Accept both (all)
                      </Button>
                    </span>
                  </Tooltip>
                  <div className='ml-auto flex items-center gap-2'>
                    <Button variant='ghost' size='sm' onClick={() => void acceptFile('ours')}>Accept ours (file)</Button>
                    <Button variant='ghost' size='sm' onClick={() => void acceptFile('theirs')}>Accept theirs (file)</Button>
                    <Button variant='ghost' size='sm' onClick={() => void resetFileToOriginal()}>Reset file</Button>
                  </div>
                </div>
              )}

              {segments.map((seg, idx) => {
                if (seg.type === 'text') {
                  return (
                    <div key={idx} className='border rounded-md border-neutral-200 dark:border-neutral-800'>
                      {renderCodeBlock(seg.text)}
                    </div>
                  )
                }
                return (
                  <div key={idx} className='border rounded-md border-amber-300/60 dark:border-amber-600/40 overflow-hidden'>
                    <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'>
                      Conflict
                    </div>
                    <div className='p-2 grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <div>
                        <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>
                          Ours: <span className='font-mono'>{seg.oursLabel || 'current'}</span>
                        </div>
                        {renderCodeBlock(seg.ours)}
                        <div className='mt-2'>
                          <Button size='sm' onClick={() => applyChoice(idx, 'ours')}>Accept ours</Button>
                        </div>
                      </div>
                      <div>
                        <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>
                          Theirs: <span className='font-mono'>{seg.theirsLabel || 'incoming'}</span>
                        </div>
                        {renderCodeBlock(seg.theirs)}
                        <div className='mt-2'>
                          <Button size='sm' onClick={() => applyChoice(idx, 'theirs')}>Accept theirs</Button>
                        </div>
                      </div>
                    </div>
                    <div className='px-3 pb-3'>
                      <Button variant='ghost' size='sm' onClick={() => applyChoice(idx, 'both')}>Accept both</Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className='flex items-center justify-between gap-2 border-t border-neutral-200 dark:border-neutral-800 pt-2'>
        <div className='text-xs text-neutral-600 dark:text-neutral-400'>
          {resolvedCount}/{totalFiles} files resolved
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='secondary'
            onClick={async () => {
              if (!window.confirm('Abort merge and discard in-progress resolution?')) return
              setAbortRunning(true)
              try {
                await gitService.resetAll(projectId)
                await recomputeResolvedAll()
                try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
              } finally {
                setAbortRunning(false)
              }
            }}
            disabled={abortRunning}
            loading={abortRunning}
          >
            Abort merge
          </Button>
          <Button
            onClick={async () => {
              if (finalizing) return
              setFinalizing(true)
              try {
                // Verify all files resolved
                await recomputeResolvedAll()
                const unresolved = Object.entries(resolvedMap).filter(([_, v]) => !v).map(([k]) => k)
                if (unresolved.length > 0) {
                  alert(`Cannot finalize: ${unresolved.length} file(s) still have unresolved markers.`)
                  return
                }
                // Stage conflicted files and commit
                try { await gitService.stage(projectId, conflicts.map((c) => c.path)) } catch {}
                const message = finalizeMsg && finalizeMsg.trim().length > 0 ? finalizeMsg : `Merge branch ${branch}`
                const res = await gitService.commit(projectId, { message })
                if (!res?.ok) {
                  alert(`Commit failed: ${res?.error || 'unknown error'}`)
                  return
                }
                if (pushImmediately) {
                  const p = await gitService.push(projectId, 'origin')
                  if (!p?.ok) alert(`Push failed: ${p?.error || 'unknown error'}`)
                }
                try { window.dispatchEvent(new CustomEvent('git:refresh-now', { detail: { projectId } })) } catch {}
                alert('Merge finalized.')
              } catch (e) {
                console.error('Finalize merge failed', e)
                alert('Finalize merge failed')
              } finally {
                setFinalizing(false)
              }
            }}
            disabled={!allResolved || finalizing}
            loading={finalizing}
          >
            Continue (finalize merge)
          </Button>
        </div>
      </div>
    </div>
  )
}
