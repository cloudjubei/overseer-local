import React from 'react'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
}

export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <div className="flex items-center space-x-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className="ui-switch"
        data-state={checked ? 'checked' : 'unchecked'}
      >
        <span className="ui-switch__thumb" />
      </button>
      {label && <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>}
    </div>
  )
}
