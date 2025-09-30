export interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

// Minimal, accessible switch with distinct disabled vs off visuals via data attributes.
export function Switch({ checked, onCheckedChange, label, disabled = false, className }: SwitchProps) {
  const state = checked ? 'checked' : 'unchecked'
  const disabledAttr = disabled ? true : undefined

  const handleClick = () => {
    if (disabled) return
    onCheckedChange(!checked)
  }

  return (
    <div className={`flex items-center space-x-2 ${className ?? ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabledAttr}
        onClick={handleClick}
        className="ui-switch"
        data-state={state}
        data-disabled={disabled ? 'true' : 'false'}
        // Use title hint to signal disabled when hovered
        title={disabled ? 'Disabled' : undefined}
      >
        <span className="ui-switch__thumb" />
      </button>
      {label && (
        <span
          className={`text-sm font-medium ${disabled ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}
        >
          {label}
        </span>
      )}
      <style>{`
        /* Enhance distinction for disabled state without relying on global CSS changes */
        .ui-switch[data-disabled="true"] {
          opacity: 0.5; /* visually distinct from off */
          cursor: not-allowed;
          filter: grayscale(30%);
        }
        .ui-switch[data-state="unchecked"][data-disabled="false"] {
          opacity: 1;
        }
        .ui-switch[data-state="unchecked"][data-disabled="true"] .ui-switch__thumb {
          /* keep thumb visible but subdued */
          box-shadow: none;
        }
      `}</style>
    </div>
  )
}
