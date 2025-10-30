import React, { useState } from 'react'
import { IconError } from './icons/Icons'

interface ErrorBubbleProps {
  error: any
  onRetry?: () => void
  disabled?: boolean
}

const ErrorBubble: React.FC<ErrorBubbleProps> = ({ error, onRetry, disabled }) => {
  const [showDetails, setShowDetails] = useState(false)

  const message: string = (error && (error.message || error.reason || error.code)) || 'Unknown error'

  return (
    <div className="relative w-full">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-100 border border-red-400 text-red-800">
        <IconError className="w-5 h-5 flex-shrink-0 mt-1" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold">An error occurred</p>
              <p className="text-sm break-words break-all">{String(message)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary btn-icon w-6 h-6 leading-none"
                title="Show error details"
                aria-label="Show error details"
                onClick={() => setShowDetails((v) => !v)}
              >
                <span className="text-[11px] font-semibold">i</span>
              </button>
            </div>
          </div>

          {showDetails ? (
            <div className="mt-2 text-xs bg-white/70 border border-red-300 text-red-900 rounded p-2 overflow-auto max-h-52">
              <pre className="whitespace-pre-wrap break-all">{(() => {
                try {
                  return JSON.stringify(error, null, 2)
                } catch (_) {
                  return String(error)
                }
              })()}</pre>
            </div>
          ) : null}

          {onRetry ? (
            <div className="mt-3">
              <button
                type="button"
                className="btn"
                onClick={() => onRetry?.()}
                disabled={!!disabled}
                title={disabled ? 'Please wait...' : 'Retry the last action'}
                aria-label="Retry the last action"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ErrorBubble
