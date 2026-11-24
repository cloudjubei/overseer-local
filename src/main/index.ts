import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  nativeImage,
  dialog,
  session,
  type NativeImage,
} from 'electron'
import { join, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { pathToFileURL } from 'node:url'
import { desktopAuthStore, registerAuthIpc } from './registerAuthIpc'
import { registerAppSnapshotIpc } from './registerAppSnapshotIpc'
import { registerSystemDictationIpc } from './registerSystemDictationIpc'
import { isStrayFileNavigation } from './navigationGuard'
import { registerDeepLinks } from './registerDeepLinks'
import appIconPath from '../../resources/icon.png?asset'

const getAppIcon = (): NativeImage => nativeImage.createFromPath(appIconPath)

let appWindow: BrowserWindow | null = null
let appSnapshot: ReturnType<typeof registerAppSnapshotIpc> | undefined

const deepLinks = registerDeepLinks({
  app,
  ipcMain,
  environment: {
    argv: process.argv,
    defaultApp: process.defaultApp === true,
    execPath: process.execPath,
    resolvePath: (path) => resolve(path),
  },
  getWindow: () => appWindow,
  openWindow: () => void createWindow(),
})

async function createWindow(): Promise<void> {
  const mainWindow = new BrowserWindow({
    width: is.dev ? 1600 : 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: getAppIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })
  appWindow = mainWindow
  deepLinks?.watchWindow(mainWindow)
  mainWindow.on('closed', () => {
    if (appWindow === mainWindow) appWindow = null
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('unresponsive', async () => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Application Unresponsive',
      message: 'The application is taking a while to respond.',
      detail: 'Do you want to force reload the app, or keep waiting?',
      buttons: ['Reload App', 'Keep Waiting'],
      defaultId: 1,
      cancelId: 1,
    })

    if (response === 0) {
      mainWindow.reload()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-prevent-unload', (event) => {
    const response = dialog.showMessageBoxSync(mainWindow, {
      type: 'warning',
      title: 'Unsaved changes',
      message: 'This app has unsaved changes. Leave anyway?',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
    })
    if (response === 0) event.preventDefault()
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isStrayFileNavigation(url, mainWindow.webContents.getURL())) event.preventDefault()
  })

  const rendererPath = join(__dirname, '../renderer/index.html')
  const devUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  appSnapshot?.watch(mainWindow, devUrl ? new URL(devUrl).href : pathToFileURL(rendererPath).href)
  if (devUrl) {
    await mainWindow.loadURL(devUrl)
  } else {
    await mainWindow.loadFile(rendererPath)
  }
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

async function startApp(): Promise<void> {
  electronApp.setAppUserModelId('com.thefactory.overseer.desktop')

  const authStore = desktopAuthStore()
  appSnapshot = registerAppSnapshotIpc(authStore)
  registerAuthIpc({ store: authStore, onChange: appSnapshot?.revokeAuth })
  // Bridge for the chat composer's mic button: triggers macOS native
  // Dictation via `osascript`. See `registerSystemDictationIpc` for
  // the full rationale and the Accessibility-permission gating.
  registerSystemDictationIpc()

  // Allow the renderer to capture microphone audio for any future
  // in-renderer audio capture path. macOS native Dictation (the
  // current desktop dictation flow) doesn't touch the renderer mic,
  // so this is dormant today; kept ready for a future hosted-STT
  // engine that runs `getUserMedia` from the renderer.
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') return callback(true)
    callback(false)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  if (process.platform === 'darwin') {
    const iconImage = getAppIcon()
    if (!iconImage.isEmpty()) {
      app.dock?.setIcon(iconImage)
    }
  }

  await createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

if (deepLinks) app.whenReady().then(startApp)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
