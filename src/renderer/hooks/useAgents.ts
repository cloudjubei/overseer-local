import { useAgents as useAgentsFromContext } from '../contexts/AgentsContext'

// Backward-compatible hook that delegates to the context implementation
export function useAgents() {
  return useAgentsFromContext()
}
