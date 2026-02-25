import React from 'react'
import type { ToolResultType } from 'thefactory-tools'
import {
  IconCheckmarkCircle,
  IconHourglass,
  IconNotAllowed,
  IconStop,
  IconError,
} from '@renderer/components/ui/icons/Icons'

export function StatusIcon({ resultType }: { resultType?: ToolResultType }) {
  const size = 'w-3.5 h-3.5'
  switch (resultType) {
    case 'errored':
      return <IconError className={`${size} text-red-500`} />
    case 'aborted':
      return <IconStop className={`${size} text-orange-500`} />
    case 'not_allowed':
      return <IconNotAllowed className={`${size} text-neutral-500`} />
    case 'require_confirmation':
      return <IconHourglass className={`${size} text-teal-500`} />
    default:
      return <IconCheckmarkCircle className={`${size} text-green-500`} />
  }
}
