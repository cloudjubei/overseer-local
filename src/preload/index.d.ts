import { ElectronAPI } from '@electron-toolkit/preload'
import type { AuthService } from '@renderer/services/authService'

declare global {
  interface Window {
    electron: ElectronAPI
    authService: AuthService
  }
}
export {}
