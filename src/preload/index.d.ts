import type { AuthService } from '@renderer/services/authService'
import type { SystemDictationService } from '@renderer/services/systemDictationService'
import type { DeepLinkService } from '@renderer/services/deepLinkService'

import type { AppSnapshotService } from './appSnapshotTypes'

declare global {
  interface Window {
    authService: AuthService
    systemDictation: SystemDictationService
    deepLinks: DeepLinkService
    appSnapshot?: AppSnapshotService
  }
}
export {}
