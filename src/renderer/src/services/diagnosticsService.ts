import type { DiagnosticsSnapshot } from 'src/types/diagnostics'

export const diagnosticsService = {
  getSnapshot: async (): Promise<DiagnosticsSnapshot> => {
    return await window.diagnosticsService.getSnapshot()
  },
}
