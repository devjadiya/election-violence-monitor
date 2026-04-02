'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-96 p-8">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h2 className="text-lg font-semibold text-zinc-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-zinc-500 mb-4 leading-relaxed">
          An error occurred while loading this page. This has been logged automatically.
        </p>
        {error.digest && (
          <p className="text-xs text-zinc-400 font-mono mb-4">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="flex items-center gap-2 bg-[#1a1a2e] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#16213e] transition-colors mx-auto"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      </div>
    </div>
  )
}