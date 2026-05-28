import { ElectronAPI } from '@electron-toolkit/preload'
import type { AuthService } from '@renderer/services/authService'
import type { SystemDictationService } from '@renderer/services/systemDictationService'

declare global {
  interface Window {
    electron: ElectronAPI
    authService: AuthService
    systemDictation: SystemDictationService
  }
}
export {}
