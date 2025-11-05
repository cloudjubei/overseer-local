import React from 'react'
import { filesService } from '@renderer/services/filesService'
import { Button } from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import Tooltip from '@renderer/components/ui/Tooltip'
import { GitConflictEntry } from 'thefactory-tools'

export type MergeConflictResolverProps = {
  projectId: string
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
    // pre-text
    if (startIdx > i) {
      segments.push({ type: 'text', text: text.slice(i, startIdx) })
    }
    const lineEnd = text.indexOf('\n', startIdx)
    const oursHeader = text.slice(startIdx + '<<<<<<< '.length, lineEnd === -1 ? text.length : lineEnd)
    const sepIdx = text.indexOf('\n=======\n', lineEnd === -1 ? startIdx : lineEnd + 1)
    if (sepIdx === -1) {
      // malformed; push rest as text
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }
    const oursContent = text.slice((lineEnd === -1 ? startIdx : lineEnd + 1), sepIdx)
    const endMarker = '\n>>>>>>>'
    const endIdx = text.indexOf(endMarker, sepIdx + '\n=======\n'.length)
    if (endIdx === -1) {
      segments.push({ type: 'text', text: text.slice(startIdx) })
      break
    }
    const theirsHeaderLineEnd = text.indexOf('\n', endIdx + endMarker.length)
    const theirsHeader = text.slice(
      endIdx + endMarker.length + 1,
      theirsHeaderLineEnd === -1 ? text.length : theirsHeaderLineEnd,
    )
    const theirsContent = text.slice(sepIdx + '\n=======\n'.length, endIdx)

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
  const lines = s.replace(/\r\n/g, '\n').split('\n')
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

export default function MergeConflictResolver({ projectId, conflicts }: MergeConflictResolverProps) {
  const [selected, setSelected] = React.useState<string | null>(conflicts[0]?.path || null)
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [content, setContent] = React.useState<string>('')
  const [segments, setSegments] = React.useState<Segment[]>([])
  const [dirty, setDirty] = React.useState(false)

  const currentConflict = conflicts.find((c) => c.path === selected) || null
  const isBinary = currentConflict?.type && /binary/i.test(String(currentConflict.type))
  const unresolvedCount = React.useMemo(() => segments.filter((s) => s.type === 'conflict').length, [segments])

  const loadFile = React.useCallback(async (path: string | null) => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const raw = await filesService.readFile(projectId, path, 'utf8')
      const data = raw ?? ''
      setContent(data)
      setSegments(parseConflictSegments(data))
      setDirty(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to read file')
      setContent('')
      setSegments([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  React.useEffect(() => {
    void loadFile(selected)
  }, [selected, loadFile])

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
      setDirty(true)
      setContent(joinSegments(next))
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
      setDirty(true)
      setContent(joinSegments(next))
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
      setDirty(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to save file')
    } finally {
      setSaving(false)
    }
  }

  const onRefresh = async () => {
    await loadFile(selected)
  }

  return (
    <div className='flex gap-3 min-h-[360px]'>
      <div className='w-64 shrink-0 border rounded-md border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden'>
        <div className='px-3 py-2 text-xs font-semibold uppercase tracking-wide bg-neutral-50 dark:bg-neutral-900/40'>
          Conflicted files
        </div>
        <div className='flex-1 overflow-auto text-sm divide-y divide-neutral-100 dark:divide-neutral-900'>
          {conflicts.map((c) => {
            const isSel = c.path === selected
            const statusCls = isSel ? 'bg-neutral-100 dark:bg-neutral-900/40' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/30'
            const unresolved = selected === c.path ? unresolvedCount > 0 : undefined
            return (
              <div
                key={c.path}
                className={`px-3 py-2 cursor-pointer ${statusCls}`}
                onClick={() => setSelected(c.path)}
                title={c.path}
              >
                <div className='truncate font-mono'>{c.path}</div>
                <div className='text-[11px] text-neutral-500'>
                  {selected === c.path ? (
                    hasConflictMarkers(content) ? 'Unresolved' : 'Resolved'
                  ) : (
                    unresolved === undefined ? '' : unresolved ? 'Unresolved' : 'Resolved'
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
            <Tooltip content={'save file'} placement='bottom'>
              <span>
                <Button onClick={onSave} loading={saving} disabled={!dirty || saving || !selected}>
                  Save
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
          <div className='p-4 text-sm text-neutral-600 dark:text-neutral-400'>Binary conflict. Please resolve using your external merge tool.</div>
        ) : (
          <div className='flex-1 min-h-0 overflow-auto p-3 flex flex-col gap-3'>
            {error && (
              <div className='text-sm text-red-600 dark:text-red-400 whitespace-pre-wrap'>{error}</div>
            )}

            {/* Quick actions */}
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
              </div>
            )}

            {/* Segments */}
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

            {/* Manual editor fallback */}
            <div>
              <div className='text-xs text-neutral-600 dark:text-neutral-400 mb-1'>Manual edit</div>
              <textarea
                value={content}
                onChange={onManualEditChange}
                className='w-full h-56 font-mono text-xs rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent p-2 resize-vertical'
                spellCheck={false}
              />
              <div className='text-[11px] text-neutral-500 mt-1'>Tip: Edits here will update the conflict view above.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
