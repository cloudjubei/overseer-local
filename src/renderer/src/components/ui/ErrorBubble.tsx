import React, { useState } from 'react'
import { IconError } from './icons/Icons'

interface ErrorBubbleProps {
  error: any
}

const ErrorBubble: React.FC<ErrorBubbleProps> = ({ error }) => {
  const [showDetails, setShowDetails] = useState(false)

  const message: string =
    (error && (error.message || error.reason || error.code)) || 'Unknown error'

  return (
    <div className="relative w-full">
      <div className="flex items-start gap-1 p-2 rounded-lg bg-red-100 border border-red-400 text-red-800">
        <button
          onClick={() => setShowDetails((v) => !v)}
          className="btn-icon"
          aria-label="Show error details"
          title="Show error details"
        >
          <IconError className="w-5 h-5" />
        </button>
        <div className="mt-1 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold">An error occurred</p>
            </div>
          </div>

          {showDetails ? (
            <div className="mt-2 text-xs bg-white/70 border border-red-300 text-red-900 rounded p-2 overflow-auto max-h-52">
              {/* Show the subtitle/message plus any extra info */}
              <div className="mb-2 break-words break-all">{String(message)}</div>
              <pre className="whitespace-pre-wrap break-all">
                {(() => {
                  try {
                    return JSON.stringify(error, null, 2)
                  } catch (_) {
                    return String(error)
                  }
                })()}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ErrorBubble
