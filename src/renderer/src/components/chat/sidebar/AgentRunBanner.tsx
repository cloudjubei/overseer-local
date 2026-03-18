export function AgentRunBanner() {
  return (
    <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3 flex items-center justify-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
        </span>
        <span className="text-sm font-medium text-blue-400">
          Agent is running. Chat is read-only.
        </span>
      </div>
    </div>
  )
}
