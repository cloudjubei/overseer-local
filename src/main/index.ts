import { app, shell, BrowserWindow, nativeImage, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAuthIpc } from './registerAuthIpc'
import { registerSystemDictationIpc } from './registerSystemDictationIpc'

const getAppIcon = () => {
  // In dev (electron-forge start + vite), __dirname points to .vite/build, so use process.cwd()
  const iconPath = join(process.cwd(), 'resources/icon.png')
  const image = nativeImage.createFromPath(iconPath)
  return image
}

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')

  registerAuthIpc()
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
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
