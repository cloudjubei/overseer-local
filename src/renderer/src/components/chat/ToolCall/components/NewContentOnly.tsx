import React from 'react'
import { toLines } from '../utils'
import { PreLimited } from './PreLimited'
import { SectionTitle } from './SectionTitle'

export function NewContentOnly({
  text,
  label,
}: {
  text?: string
  label?: string
}) {
  const header = label || 'New content only. Diff unavailable.'
  const lines = toLines(text)

  return (
    <div className='text-xs space-y-1'>
      <SectionTitle>{header}</SectionTitle>
      <PreLimited lines={lines} maxLines={25} />
    </div>
  )
}
