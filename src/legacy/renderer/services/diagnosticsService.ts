import type { DiagnosticsSnapshot } from 'src/types/diagnostics'

export type DiagnosticsService = {
  getSnapshot: () => Promise<DiagnosticsSnapshot>
}

export const diagnosticsService: DiagnosticsService = {
  getSnapshot: async (): Promise<DiagnosticsSnapshot> => {
    return await window.diagnosticsService.getSnapshot()
  },
}
