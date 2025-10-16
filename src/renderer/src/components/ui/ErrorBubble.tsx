import React from 'react'
import { IconError } from './icons/Icons'

interface ErrorBubbleProps {
  error: {
    message: string
  }
}

const ErrorBubble: React.FC<ErrorBubbleProps> = ({ error }) => {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-100 border border-red-400 text-red-800">
      <IconError className="w-5 h-5 flex-shrink-0 mt-1" />
      <div className="flex-1">
        <p className="font-bold">An error occurred</p>
        <p className="text-sm">{error.message}</p>
      </div>
    </div>
  )
}

export default ErrorBubble
