import { Spinner } from 'thefactory-ui/web'

export type LoadingScreenProps = {
  label: string
  error?: string | null
}

/**
 * Pure presentational loading/error view. All orchestration (which stage
 * we're at, when to move on) is the caller's concern.
 */
export default function LoadingScreen({ label, error = null }: LoadingScreenProps) {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="flex flex-col items-center gap-3 max-w-md text-center px-6">
        {!error && <Spinner size={32} />}
        <div className="text-sm opacity-80">{label}</div>
        {error && (
          <div className="text-xs opacity-70 mt-2" style={{ color: 'var(--color-red-700)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
